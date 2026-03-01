import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { buildOAuthAuthorizeUrl, buildOAuthRedirectUri, createOAuthState, normalizeProvider } from "@/lib/integrations/providers";
import { jsonError } from "@/lib/utils/http";

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

    const state = createOAuthState({
      workspaceId: session.workspaceId,
      provider,
      at: Date.now()
    });

    const authUrl = buildOAuthAuthorizeUrl(provider, state);

    if (!authUrl) {
      return NextResponse.json({
        provider,
        state,
        redirectUri: buildOAuthRedirectUri(provider),
        authUrl: null,
        mode: "manual",
        message: `Missing OAuth client configuration for ${provider}`
      });
    }

    return NextResponse.json({
      provider,
      state,
      redirectUri: buildOAuthRedirectUri(provider),
      authUrl,
      mode: "oauth"
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not initialize integration", 500);
  }
}
