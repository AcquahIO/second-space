import { describe, expect, it, vi } from "vitest";
import type { RealtimeEvent } from "@second-space/shared-types";
import { buildPresentationPatchForEvent, resolveWorkspaceIdForRealtimeEvent } from "./events";

describe("presentation worker events", () => {
  it("resolves workspace ids directly from payload when present", async () => {
    const workspaceId = await resolveWorkspaceIdForRealtimeEvent({} as never, {
      type: "feed.event",
      payload: {
        workspaceId: "ws_123"
      },
      emittedAt: new Date().toISOString()
    } as RealtimeEvent);

    expect(workspaceId).toBe("ws_123");
  });

  it("returns integration patches for integration connection events", async () => {
    const prisma = {
      workspaceIntegration: {
        findMany: vi.fn().mockResolvedValue([
          {
            provider: "GITHUB",
            authStatus: "CONNECTED",
            accountLabel: "AcquahIO",
            tokenMetadata: {
              repoOwner: "AcquahIO",
              repoName: "second-space",
              defaultBranch: "main"
            }
          }
        ])
      }
    };

    const patch = await buildPresentationPatchForEvent(prisma as never, "ws_123", {
      type: "integration.connected",
      payload: {
        workspaceId: "ws_123",
        provider: "GITHUB",
        connectedAt: new Date().toISOString()
      },
      emittedAt: new Date().toISOString()
    });

    expect(patch?.integrations?.connectedCount).toBe(1);
    expect(patch?.integrations?.items[0]?.repoFullName).toBe("AcquahIO/second-space");
  });
});
