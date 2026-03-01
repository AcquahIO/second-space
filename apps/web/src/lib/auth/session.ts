import type { PresentationTokenPayload, SessionTokenPayload } from "@second-space/shared-types";
import {
  createPresentationToken,
  createSignedToken,
  verifyPresentationToken,
  verifySignedToken
} from "@second-space/shared-types/token-signing";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

export interface SessionPayload extends SessionTokenPayload {
  email: string;
  role: string;
  workspaceId: string;
}

const SESSION_COOKIE = "second_space_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function getSessionSecret(): string {
  const configuredSecret = getRuntimeEnv("SESSION_SECRET");
  if (configuredSecret) {
    return configuredSecret;
  }

  if (process.env.NODE_ENV !== "production") {
    return "second-space-development-session-secret";
  }

  throw new Error("SESSION_SECRET is required");
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  };

  return createSignedToken<SessionPayload>(fullPayload, getSessionSecret());
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  const payload = verifySignedToken<SessionPayload>(token, getSessionSecret());
  if (!payload?.workspaceId || !payload.email || !payload.role) {
    return null;
  }

  return payload;
}

export function createWorkspacePresentationToken(input: Omit<PresentationTokenPayload, "exp">): {
  token: string;
  expiresAt: string;
} {
  return createPresentationToken(input, getSessionSecret());
}

export function verifyWorkspacePresentationToken(token: string | undefined): PresentationTokenPayload | null {
  return verifyPresentationToken(token, getSessionSecret());
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}
