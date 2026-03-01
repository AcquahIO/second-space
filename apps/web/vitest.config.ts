import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

function resolveFromHere(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  resolve: {
    alias: [
      { find: "@second-space/shared-types", replacement: resolveFromHere("../../packages/shared-types/src") },
      {
        find: /^@second-space\/shared-types\/(.+)$/,
        replacement: `${resolveFromHere("../../packages/shared-types/src")}/$1`
      },
      { find: "@second-space/sim-engine", replacement: resolveFromHere("../../packages/sim-engine/src") },
      {
        find: /^@second-space\/sim-engine\/(.+)$/,
        replacement: `${resolveFromHere("../../packages/sim-engine/src")}/$1`
      },
      { find: "@second-space/tool-adapters", replacement: resolveFromHere("../../packages/tool-adapters/src") },
      {
        find: /^@second-space\/tool-adapters\/(.+)$/,
        replacement: `${resolveFromHere("../../packages/tool-adapters/src")}/$1`
      },
      { find: /^@\/(.+)$/, replacement: `${resolveFromHere("./src")}/$1` }
    ]
  },
  test: {
    environment: "node"
  }
});
