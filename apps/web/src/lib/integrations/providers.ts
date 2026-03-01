import type { IntegrationCapability, IntegrationProvider } from "@second-space/shared-types";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

const PROVIDERS = ["GITHUB", "LINKEDIN", "GMAIL"] as const;

export function normalizeProvider(input: string): IntegrationProvider | null {
  const upper = input.trim().toUpperCase();
  return PROVIDERS.includes(upper as IntegrationProvider) ? (upper as IntegrationProvider) : null;
}

export function defaultCapabilities(provider: IntegrationProvider): IntegrationCapability[] {
  if (provider === "GITHUB") {
    return ["READ", "WRITE", "COMMIT", "PUSH"];
  }

  if (provider === "LINKEDIN") {
    return ["READ", "POST"];
  }

  return ["READ", "SEND"];
}

export function getProviderOAuthConfig(provider: IntegrationProvider) {
  if (provider === "GITHUB") {
    return {
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      scopes: ["repo", "read:user", "user:email"]
    };
  }

  if (provider === "LINKEDIN") {
    return {
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      clientId: process.env.LINKEDIN_CLIENT_ID ?? "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
      scopes: ["r_liteprofile", "r_emailaddress", "w_member_social"]
    };
  }

  return {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    scopes: ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly"]
  };
}

export function buildOAuthRedirectUri(provider: IntegrationProvider) {
  const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
  return `${baseUrl}/api/integrations/${provider.toLowerCase()}/callback`;
}

function signState(input: string): string {
  const secret = getRuntimeEnv("SESSION_SECRET") ?? "development";
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function createOAuthState(payload: { workspaceId: string; provider: IntegrationProvider; at: number }) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signState(encoded);
  return `${encoded}.${signature}`;
}

export function parseOAuthState(state: string): { workspaceId: string; provider: IntegrationProvider; at: number } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signState(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as {
      workspaceId: string;
      provider: IntegrationProvider;
      at: number;
    };

    if (!parsed.workspaceId || !parsed.provider || !parsed.at) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildOAuthAuthorizeUrl(provider: IntegrationProvider, state: string) {
  const config = getProviderOAuthConfig(provider);
  const redirectUri = buildOAuthRedirectUri(provider);

  if (!config.clientId) {
    return null;
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: config.scopes.join(" "),
    state
  });

  if (provider === "GMAIL") {
    params.set("access_type", "offline");
    params.set("prompt", "consent");
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}
