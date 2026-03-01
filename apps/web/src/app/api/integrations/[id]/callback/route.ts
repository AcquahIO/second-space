import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import {
  buildOAuthRedirectUri,
  defaultCapabilities,
  getProviderOAuthConfig,
  normalizeProvider,
  parseOAuthState
} from "@/lib/integrations/providers";
import { encryptCredential } from "@/lib/security/credentials";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";
import { DEFAULT_INTEGRATION_PERMISSION_MATRIX, type SpecialistRole } from "@second-space/shared-types";

const callbackSchema = z.object({
  code: z.string().min(1),
  refreshToken: z.string().optional(),
  accountLabel: z.string().optional(),
  capabilities: z.array(z.enum(["READ", "WRITE", "POST", "SEND", "COMMIT", "PUSH"])).optional()
});

async function ensureDefaultAgentPermissions(workspaceId: string, provider: "GITHUB" | "LINKEDIN" | "GMAIL", integrationId: string) {
  const existingPermissions = await prisma.agentIntegrationPermission.count({
    where: {
      workspaceIntegrationId: integrationId
    }
  });

  if (existingPermissions > 0) {
    return;
  }

  const agents = await prisma.agent.findMany({
    where: {
      workspaceId
    },
    select: {
      id: true,
      specialistRole: true
    }
  });

  for (const agent of agents) {
    const capabilities = DEFAULT_INTEGRATION_PERMISSION_MATRIX[agent.specialistRole as SpecialistRole]?.[provider];
    if (!capabilities?.length) {
      continue;
    }

    await prisma.agentIntegrationPermission.create({
      data: {
        workspaceIntegrationId: integrationId,
        agentId: agent.id,
        capabilities
      }
    });
  }
}

async function finalizeIntegration(input: {
  workspaceId: string;
  provider: "GITHUB" | "LINKEDIN" | "GMAIL";
  accessToken: string;
  refreshToken?: string | null;
  accountLabel?: string | null;
  capabilities?: Array<"READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH">;
  userId?: string;
  tokenMetadata?: Record<string, unknown>;
}) {
  const integration = await prisma.workspaceIntegration.upsert({
    where: {
      workspaceId_provider: {
        workspaceId: input.workspaceId,
        provider: input.provider
      }
    },
    update: {
      authStatus: "CONNECTED",
      accountLabel: input.accountLabel?.trim() || `${input.provider} workspace`,
      accessTokenEncrypted: encryptCredential(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encryptCredential(input.refreshToken) : null,
      capabilities: input.capabilities ?? defaultCapabilities(input.provider),
      tokenMetadata: {
        connectedAt: new Date().toISOString(),
        provider: input.provider,
        linkedInPostingFallback: input.provider === "LINKEDIN",
        ...input.tokenMetadata
      }
    },
    create: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      authStatus: "CONNECTED",
      accountLabel: input.accountLabel?.trim() || `${input.provider} workspace`,
      accessTokenEncrypted: encryptCredential(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encryptCredential(input.refreshToken) : null,
      capabilities: input.capabilities ?? defaultCapabilities(input.provider),
      tokenMetadata: {
        connectedAt: new Date().toISOString(),
        provider: input.provider,
        linkedInPostingFallback: input.provider === "LINKEDIN",
        ...input.tokenMetadata
      }
    }
  });

  await ensureDefaultAgentPermissions(input.workspaceId, input.provider, integration.id);

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: "INTEGRATION_CONNECTED",
      target: integration.provider,
      metadata: {
        integrationId: integration.id
      }
    }
  });

  await prisma.workspaceOnboardingStep.upsert({
    where: {
      workspaceId_step: {
        workspaceId: input.workspaceId,
        step: "INTEGRATIONS_CONNECTED"
      }
    },
    update: {
      completedAt: new Date()
    },
    create: {
      workspaceId: input.workspaceId,
      step: "INTEGRATIONS_CONNECTED"
    }
  });

  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: {
      onboardingState: "INTEGRATIONS_CONNECTED"
    }
  });

  await publishRealtimeEvent("integration.connected", {
    workspaceId: input.workspaceId,
    provider: input.provider,
    connectedAt: new Date().toISOString()
  });

  return integration;
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const provider = normalizeProvider(context.params.id);
    if (!provider) {
      return jsonError("Unsupported provider", 400);
    }

    const code = String(request.nextUrl.searchParams.get("code") ?? "");
    const state = String(request.nextUrl.searchParams.get("state") ?? "");

    if (!code || !state) {
      return jsonError("Missing OAuth code/state", 400);
    }

    const parsedState = parseOAuthState(state);
    if (!parsedState || parsedState.provider !== provider) {
      return jsonError("Invalid OAuth state", 400);
    }

    const session = getSessionFromRequest(request);
    if (!session || session.workspaceId !== parsedState.workspaceId) {
      return unauthorizedJson();
    }

    const config = getProviderOAuthConfig(provider);
    if (!config.clientId || !config.clientSecret || provider !== "GITHUB") {
      return NextResponse.json(
        {
          provider,
          mode: "manual",
          message: "OAuth exchange is unavailable in this environment; use manual callback POST.",
          redirectUri: buildOAuthRedirectUri(provider),
          code
        },
        { status: 400 }
      );
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: buildOAuthRedirectUri(provider)
      })
    });

    if (!tokenResponse.ok) {
      const failureBody = await tokenResponse.text();
      return jsonError(`OAuth token exchange failed: ${failureBody || tokenResponse.statusText}`, 400);
    }

    const tokenPayload = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      token_type?: string;
      scope?: string;
    };

    if (!tokenPayload.access_token) {
      return jsonError("OAuth exchange did not return access_token", 400);
    }

    let accountLabel = "GitHub workspace";
    try {
      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (userRes.ok) {
        const userPayload = (await userRes.json()) as { login?: string; name?: string };
        accountLabel = userPayload.login || userPayload.name || accountLabel;
      }
    } catch {
      // Keep default account label.
    }

    const integration = await finalizeIntegration({
      workspaceId: session.workspaceId,
      provider: "GITHUB",
      accessToken: tokenPayload.access_token,
      refreshToken: tokenPayload.refresh_token ?? null,
      accountLabel,
      userId: session.sub,
      tokenMetadata: {
        oauthFlow: "github_authorization_code",
        scope: tokenPayload.scope ?? null,
        tokenType: tokenPayload.token_type ?? null
      }
    });

    return NextResponse.json({
      integration: {
        id: integration.id,
        workspaceId: integration.workspaceId,
        provider: integration.provider,
        authStatus: integration.authStatus,
        accountLabel: integration.accountLabel,
        capabilities: integration.capabilities,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not finalize OAuth callback", 500);
  }
}

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const provider = normalizeProvider(context.params.id);
    if (!provider) {
      return jsonError("Unsupported provider", 400);
    }

    const payload = callbackSchema.parse(await request.json());

    const integration = await finalizeIntegration({
      workspaceId: session.workspaceId,
      provider,
      accessToken: payload.code,
      refreshToken: payload.refreshToken ?? null,
      accountLabel: payload.accountLabel ?? `${provider} workspace`,
      capabilities: payload.capabilities,
      userId: session.sub,
      tokenMetadata: {
        oauthFlow: "manual_fallback"
      }
    });

    return NextResponse.json({
      integration: {
        id: integration.id,
        workspaceId: integration.workspaceId,
        provider: integration.provider,
        authStatus: integration.authStatus,
        accountLabel: integration.accountLabel,
        capabilities: integration.capabilities,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid integration callback payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not finalize integration", 500);
  }
}
