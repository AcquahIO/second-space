import { describe, expect, it } from "vitest";
import type { WorkspaceSceneAgent } from "@second-space/shared-types";
import {
  buildSceneSummary,
  mapAgentStateToStatusTone,
  parseSceneInclude,
  parseSceneView,
  resolveSceneZone
} from "./workspace-scene-helpers";

function agentState(state: WorkspaceSceneAgent["state"]): Pick<WorkspaceSceneAgent, "state"> {
  return { state };
}

describe("workspace-scene-helpers", () => {
  it("defaults the scene view to office", () => {
    expect(parseSceneView(null)).toBe("office");
    expect(parseSceneView("invalid")).toBe("office");
    expect(parseSceneView("overview")).toBe("overview");
  });

  it("filters include flags down to supported values", () => {
    expect([...parseSceneInclude("feed,tasks,invalid,integrations")]).toEqual(["feed", "tasks", "integrations"]);
  });

  it("maps blocked state to blocked tone", () => {
    expect(mapAgentStateToStatusTone("BLOCKED")).toBe("blocked");
  });

  it("resolves scene zones using nearest waypoints", () => {
    expect(resolveSceneZone(390, 280)).toBe("specialistPodA");
    expect(resolveSceneZone(90, 280)).toBe("waitingArea");
    expect(resolveSceneZone(null, null)).toBe("lobby");
  });

  it("builds aggregate scene summary counts", () => {
    expect(
      buildSceneSummary(
        [agentState("IDLE"), agentState("MEETING"), agentState("WORKING"), agentState("BLOCKED")],
        2,
        1
      )
    ).toEqual({
      onlineAgents: 4,
      meetingCount: 1,
      blockedCount: 1,
      workingCount: 1,
      approvalCount: 2,
      activeHoldCount: 1
    });
  });
});
