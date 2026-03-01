import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let fileEnvCache: Record<string, string> | null = null;

function normalizeEnvValue(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed.replace(/\s+#.*$/, "").trim();
}

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    parsed[key] = normalizeEnvValue(rawValue);
  }

  return parsed;
}

function getCandidateEnvFiles(): string[] {
  const cwd = process.cwd();

  return Array.from(
    new Set([
      path.resolve(cwd, ".env.local"),
      path.resolve(cwd, ".env"),
      path.resolve(cwd, "../../.env.local"),
      path.resolve(cwd, "../../.env")
    ])
  );
}

function loadFileEnv(): Record<string, string> {
  if (fileEnvCache) {
    return fileEnvCache;
  }

  const loaded: Record<string, string> = {};

  for (const filePath of getCandidateEnvFiles()) {
    if (!existsSync(filePath)) {
      continue;
    }

    Object.assign(loaded, parseEnvFile(readFileSync(filePath, "utf8")));
  }

  fileEnvCache = loaded;
  return loaded;
}

export function getRuntimeEnv(key: string): string | undefined {
  const processValue = process.env[key]?.trim();
  if (processValue) {
    return processValue;
  }

  const fileValue = loadFileEnv()[key]?.trim();
  return fileValue || undefined;
}
