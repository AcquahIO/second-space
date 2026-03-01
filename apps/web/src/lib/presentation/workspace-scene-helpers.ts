import type { AgentState } from "@second-space/shared-types";
import {
  WORKSPACE_SCENE_INCLUDES,
  WORKSPACE_SCENE_VIEWS,
  type WorkspaceSceneAgent,
  type WorkspaceSceneInclude,
  type WorkspaceSceneStatusTone,
  type WorkspaceSceneSummary,
  type WorkspaceSceneView,
  type WorkspaceSceneZone
} from "@second-space/shared-types";
import { OFFICE_WAYPOINTS } from "@second-space/sim-engine";

const DEFAULT_SCENE_VIEW: WorkspaceSceneView = "office";

const waypointEntries = Object.entries(OFFICE_WAYPOINTS) as Array<
  [WorkspaceSceneZone, { x: number; y: number }]
>;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseSceneView(raw: string | null | undefined): WorkspaceSceneView {
  if (!raw) {
    return DEFAULT_SCENE_VIEW;
  }

  return WORKSPACE_SCENE_VIEWS.includes(raw as WorkspaceSceneView) ? (raw as WorkspaceSceneView) : DEFAULT_SCENE_VIEW;
}

export function parseSceneInclude(raw: string | null | undefined): Set<WorkspaceSceneInclude> {
  if (!raw) {
    return new Set();
  }

  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return new Set(tokens.filter((token): token is WorkspaceSceneInclude => WORKSPACE_SCENE_INCLUDES.includes(token as WorkspaceSceneInclude)));
}

export function mapAgentStateToStatusTone(state: AgentState): WorkspaceSceneStatusTone {
  switch (state) {
    case "MOVING":
      return "moving";
    case "WORKING":
      return "working";
    case "MEETING":
      return "meeting";
    case "BLOCKED":
      return "blocked";
    case "IDLE":
    default:
      return "neutral";
  }
}

export function getSceneBadgeLabel(name: string): string {
  const firstToken = name.trim().split(/\s+/)[0];
  return firstToken || "Agent";
}

export function resolveSceneZone(x: number | null | undefined, y: number | null | undefined): WorkspaceSceneZone {
  if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
    return "lobby";
  }

  let nearestZone: WorkspaceSceneZone = "lobby";
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const [zone, point] of waypointEntries) {
    const distance = Math.hypot(point.x - x, point.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestZone = zone;
    }
  }

  return nearestZone;
}

export function buildSceneSummary(
  agents: Pick<WorkspaceSceneAgent, "state">[],
  pendingApprovalCount: number,
  activeHoldCount: number
): WorkspaceSceneSummary {
  return {
    onlineAgents: agents.length,
    meetingCount: agents.filter((agent) => agent.state === "MEETING").length,
    blockedCount: agents.filter((agent) => agent.state === "BLOCKED").length,
    workingCount: agents.filter((agent) => agent.state === "WORKING").length,
    approvalCount: pendingApprovalCount,
    activeHoldCount
  };
}
