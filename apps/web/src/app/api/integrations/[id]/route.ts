import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

interface RouteContext {
  params: {
    id: string;
  };
}

const patchIntegrationSchema = z.object({
  accountLabel: z.string().min(1).max(120).optional(),
  repoOwner: z.string().min(1).max(120).optional(),
  repoName: z.string().min(1).max(120).optional(),
  defaultBranch: z.string().min(1).max(120).optional()
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const integration = await prisma.workspaceIntegration.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      },
      include: {
        agentPermissions: true
      }
    });

    if (!integration) {
      return jsonError("Integration not found", 404);
    }

    return NextResponse.json({ integration });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch integration", 500);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const integration = await prisma.workspaceIntegration.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!integration) {
      return jsonError("Integration not found", 404);
    }

    const payload = patchIntegrationSchema.parse(await request.json());
    const currentMetadata =
      typeof integration.tokenMetadata === "object" && integration.tokenMetadata
        ? (integration.tokenMetadata as Record<string, unknown>)
        : {};

    const tokenMetadata = {
      ...currentMetadata,
      repoOwner: payload.repoOwner ?? currentMetadata.repoOwner ?? null,
      repoName: payload.repoName ?? currentMetadata.repoName ?? null,
      defaultBranch: payload.defaultBranch ?? currentMetadata.defaultBranch ?? "main"
    };

    const updated = await prisma.workspaceIntegration.update({
      where: {
        id: integration.id
      },
      data: {
        accountLabel: payload.accountLabel?.trim() ?? integration.accountLabel,
        tokenMetadata
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "INTEGRATION_UPDATED",
        target: updated.id,
        metadata: {
          provider: updated.provider,
          repoOwner: tokenMetadata.repoOwner,
          repoName: tokenMetadata.repoName,
          defaultBranch: tokenMetadata.defaultBranch
        }
      }
    });

    return NextResponse.json({ integration: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid integration update payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not update integration", 500);
  }
}
