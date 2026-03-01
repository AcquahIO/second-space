import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";

function resolveKey(): Buffer {
  const configured = getRuntimeEnv("CREDENTIAL_ENCRYPTION_KEY") || getRuntimeEnv("SESSION_SECRET");

  if (!configured) {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY or SESSION_SECRET is required");
  }

  if (configured.length === 44 && configured.endsWith("=")) {
    try {
      const decoded = Buffer.from(configured, "base64");
      if (decoded.length === 32) {
        return decoded;
      }
    } catch {
      // Fall through to sha256 derivation.
    }
  }

  return createHash("sha256").update(configured).digest();
}

export function encryptCredential(plainText: string): string {
  const key = resolveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptCredential(payload: string): string {
  const key = resolveKey();
  const buffer = Buffer.from(payload, "base64");

  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
