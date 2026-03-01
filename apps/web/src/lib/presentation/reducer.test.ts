import { describe, expect, it } from "vitest";
import type { WorkspaceSceneResponse } from "@second-space/shared-types";
import { applyPresentationScenePatch, presentationSceneReducer } from "./reducer";

function buildScene(): WorkspaceSceneResponse {
  return {
    workspace: {
      id: "ws_1",
      name: "Workspace",
      slug: "workspace",
      onboardingState: "WORKSPACE_SETUP",
      subscriptionStatus: "TRIALING",
      blockedByWorkspaceHold: false
    },
    scene: {
      version: "v1",
      view: "office",
      cameraPreset: "workspace-office-v1",
      generatedAt: "2026-03-01T10:00:00.000Z",
      waypoints: {
        lobby: { x: 100, y: 100 },
        directorDesk: { x: 220, y: 100 },
        managerDeskA: { x: 300, y: 130 },
        managerDeskB: { x: 360, y: 130 },
        specialistPodA: { x: 400, y: 280 },
        specialistPodB: { x: 500, y: 280 },
        meetingRoom: { x: 200, y: 220 },
        waitingArea: { x: 90, y: 280 },
        breakArea: { x: 540, y: 110 }
      },
      zoneOccupancy: [
        {
          zone: "lobby",
          count: 1,
          agentIds: ["agent_1"],
          blockedCount: 0,
          workingCount: 0,
          meetingCount: 0
        }
      ]
    },
    summary: {
      onlineAgents: 1,
      meetingCount: 0,
      blockedCount: 0,
      workingCount: 0,
      approvalCount: 0,
      activeHoldCount: 0
    },
    agents: [
      {
        id: "agent_1",
        name: "Parker Project",
        role: "MANAGER",
        specialistRole: "PROJECT_MANAGER",
        specialty: "Planning",
        state: "IDLE",
        mood: "NEUTRAL",
        managerId: null,
        managerName: null,
        simPosition: { x: 100, y: 100 },
        zone: "lobby",
        badge: {
          label: "Parker",
          statusTone: "neutral",
          selected: true
        }
      }
    ],
    selectedAgent: null,
    feed: [],
    approvals: [],
    holds: [],
    integrations: {
      connectedCount: 0,
      items: []
    }
  };
}

describe("presentation reducer", () => {
  it("applies top-level scene patches without dropping existing slices", () => {
    const current = buildScene();
    const next = applyPresentationScenePatch(current, {
      summary: {
        ...current.summary,
        approvalCount: 2
      },
      scene: {
        generatedAt: "2026-03-01T10:05:00.000Z",
        zoneOccupancy: [
          {
            zone: "meetingRoom",
            count: 1,
            agentIds: ["agent_1"],
            blockedCount: 0,
            workingCount: 0,
            meetingCount: 1
          }
        ]
      }
    });

    expect(next.summary.approvalCount).toBe(2);
    expect(next.scene.generatedAt).toBe("2026-03-01T10:05:00.000Z");
    expect(next.scene.zoneOccupancy[0]?.zone).toBe("meetingRoom");
    expect(next.workspace.id).toBe(current.workspace.id);
  });

  it("boots and patches state through the reducer", () => {
    const initial = presentationSceneReducer({ scene: null }, { type: "bootstrap", scene: buildScene() });
    const updated = presentationSceneReducer(initial, {
      type: "patch",
      changes: {
        feed: [
          {
            id: "feed_1",
            message: "Task updated",
            category: "TASK",
            createdAt: "2026-03-01T10:06:00.000Z"
          }
        ]
      }
    });

    expect(updated.scene?.feed).toHaveLength(1);
    expect(updated.scene?.feed?.[0]?.message).toBe("Task updated");
  });
});
