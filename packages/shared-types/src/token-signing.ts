import { createHmac, timingSafeEqual } from "node:crypto";
import {
  PRESENTATION_TOKEN_TTL_SECONDS,
  type PresentationTokenPayload,
  type SessionTokenPayload
} from "./session-token";

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function signTokenPayload(encodedPayload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(encodedPayload).digest());
}

export function createSignedToken<T extends SessionTokenPayload>(payload: T, secret: string): string {
  const encodedPayload = b64url(JSON.stringify(payload));
  const signature = signTokenPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken<T extends SessionTokenPayload>(token: string | undefined, secret: string): T | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signTokenPayload(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromB64url(encodedPayload).toString("utf8")) as T;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    if (!payload.sub) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createPresentationToken(
  payload: Omit<PresentationTokenPayload, "exp">,
  secret: string,
  expiresInSeconds = PRESENTATION_TOKEN_TTL_SECONDS
): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const token = createSignedToken<PresentationTokenPayload>({ ...payload, exp }, secret);

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString()
  };
}

export function verifyPresentationToken(token: string | undefined, secret: string): PresentationTokenPayload | null {
  const payload = verifySignedToken<PresentationTokenPayload>(token, secret);
  if (!payload?.workspaceId || !payload.channel) {
    return null;
  }

  return payload;
}
