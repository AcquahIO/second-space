import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSceneResponse } from "@second-space/shared-types";

const { mockGetSessionFromRequest, mockBuildWorkspaceScene } = vi.hoisted(() => ({
  mockGetSessionFromRequest: vi.fn(),
  mockBuildWorkspaceScene: vi.fn()
}));

vi.mock("@/lib/auth/server-auth", () => ({
  getSessionFromRequest: mockGetSessionFromRequest,
  unauthorizedJson: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
  assertWorkspaceSubscriptionActive: vi.fn()
}));

vi.mock("@/lib/presentation/workspace-scene", () => ({
  buildWorkspaceScene: mockBuildWorkspaceScene
}));

import { GET } from "./route";

describe("GET /api/presentation/workspace-scene", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized when no session is present", async () => {
    mockGetSessionFromRequest.mockReturnValue(null);

    const response = await GET(new NextRequest("http://localhost:3000/api/presentation/workspace-scene"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockBuildWorkspaceScene).not.toHaveBeenCalled();
  });

  it("parses request params and returns the workspace scene snapshot", async () => {
    const scene: WorkspaceSceneResponse = {
      workspace: {
        id: "ws_123",
        name: "Second Space",
        slug: "second-space",
        onboardingState: "LAUNCHED",
        subscriptionStatus: "TRIALING",
        blockedByWorkspaceHold: false
      },
      scene: {
        version: "v1",
        view: "overview",
        cameraPreset: "workspace-overview-v1",
        generatedAt: "2026-03-01T12:00:00.000Z",
        waypoints: {
          lobby: { x: 80, y: 120 },
          directorDesk: { x: 330, y: 170 },
          managerDeskA: { x: 460, y: 170 },
          managerDeskB: { x: 560, y: 170 },
          specialistPodA: { x: 390, y: 280 },
          specialistPodB: { x: 560, y: 300 },
          meetingRoom: { x: 250, y: 80 },
          waitingArea: { x: 110, y: 260 },
          breakArea: { x: 700, y: 120 }
        },
        zoneOccupancy: []
      },
      summary: {
        onlineAgents: 1,
        meetingCount: 0,
        blockedCount: 0,
        workingCount: 1,
        approvalCount: 0,
        activeHoldCount: 0
      },
      agents: [],
      selectedAgent: null
    };

    mockGetSessionFromRequest.mockReturnValue({
      sub: "user_123",
      workspaceId: "ws_123"
    });
    mockBuildWorkspaceScene.mockResolvedValue(scene);

    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/presentation/workspace-scene?view=overview&selectedAgentId=%20agent_1%20&include=feed,tasks,invalid"
      )
    );

    expect(mockBuildWorkspaceScene).toHaveBeenCalledTimes(1);
    expect(mockBuildWorkspaceScene).toHaveBeenCalledWith(
      "ws_123",
      expect.objectContaining({
        view: "overview",
        selectedAgentId: "agent_1",
        include: expect.any(Set)
      })
    );
    expect(Array.from(mockBuildWorkspaceScene.mock.calls[0]?.[1]?.include ?? [])).toEqual(["feed", "tasks"]);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(scene);
  });
});
