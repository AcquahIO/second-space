import type {
  AgentRole,
  AgentState,
  IntegrationAuthStatus,
  IntegrationProvider,
  Mood,
  SpecialistRole,
  TaskStatus,
  WorkspaceOnboardingState,
  WorkspaceSubscriptionStatus
} from "./domain";

export const WORKSPACE_SCENE_VIEWS = ["office", "overview"] as const;
export type WorkspaceSceneView = (typeof WORKSPACE_SCENE_VIEWS)[number];

export const WORKSPACE_SCENE_ZONES = [
  "lobby",
  "directorDesk",
  "managerDeskA",
  "managerDeskB",
  "specialistPodA",
  "specialistPodB",
  "meetingRoom",
  "waitingArea",
  "breakArea"
] as const;
export type WorkspaceSceneZone = (typeof WORKSPACE_SCENE_ZONES)[number];

export const WORKSPACE_SCENE_STATUS_TONES = ["neutral", "moving", "working", "meeting", "blocked"] as const;
export type WorkspaceSceneStatusTone = (typeof WORKSPACE_SCENE_STATUS_TONES)[number];

export const WORKSPACE_SCENE_INCLUDES = ["tasks", "feed", "integrations", "holds", "approvals"] as const;
export type WorkspaceSceneInclude = (typeof WORKSPACE_SCENE_INCLUDES)[number];

export interface WorkspaceSceneWaypoint {
  x: number;
  y: number;
}

export type WorkspaceSceneWaypoints = Record<WorkspaceSceneZone, WorkspaceSceneWaypoint>;

export interface WorkspaceSceneBadge {
  label: string;
  statusTone: WorkspaceSceneStatusTone;
  selected: boolean;
}

export interface WorkspaceSceneAgent {
  id: string;
  name: string;
  role: AgentRole;
  specialistRole: SpecialistRole;
  specialty: string;
  state: AgentState;
  mood: Mood;
  managerId: string | null;
  managerName: string | null;
  simPosition: WorkspaceSceneWaypoint | null;
  zone: WorkspaceSceneZone;
  badge: WorkspaceSceneBadge;
}

export interface WorkspaceSceneSummary {
  onlineAgents: number;
  meetingCount: number;
  blockedCount: number;
  workingCount: number;
  approvalCount: number;
  activeHoldCount: number;
}

export interface WorkspaceSceneIntegrationStatus {
  provider: IntegrationProvider;
  authStatus: IntegrationAuthStatus;
  connected: boolean;
  accountLabel: string | null;
  repoFullName: string | null;
  defaultBranch: string | null;
}

export interface WorkspaceSceneIntegrations {
  connectedCount: number;
  items: WorkspaceSceneIntegrationStatus[];
}

export interface WorkspaceSceneSelectedAgent {
  id: string;
  name: string;
  title: string;
  specialty: string;
  summary: string;
  state: AgentState;
  mood: Mood;
  zone: WorkspaceSceneZone;
  managerName: string | null;
  currentTaskCount: number;
  blockedTaskCount: number;
  latestFeedMessage: string | null;
}

export interface WorkspaceSceneTaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string;
  requiresApproval: boolean;
  externalAction: boolean;
  updatedAt: string;
}

export interface WorkspaceSceneFeedItem {
  id: string;
  message: string;
  category: "TASK" | "SYSTEM";
  createdAt: string;
}

export interface WorkspaceSceneApprovalSummary {
  id: string;
  taskId: string;
  taskTitle: string;
  taskStatus: TaskStatus;
  assigneeId: string;
  assigneeName: string;
  createdAt: string;
}

export interface WorkspaceSceneHoldSummary {
  id: string;
  scope: "TASK" | "WORKSPACE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "RELEASED";
  reason: string;
  taskId: string | null;
  createdAt: string;
}

export interface WorkspaceSceneWorkspace {
  id: string;
  name: string;
  slug: string;
  onboardingState: WorkspaceOnboardingState;
  subscriptionStatus: WorkspaceSubscriptionStatus | null;
  blockedByWorkspaceHold: boolean;
}

export interface WorkspaceScene {
  view: WorkspaceSceneView;
  cameraPreset: string;
  generatedAt: string;
  waypoints: WorkspaceSceneWaypoints;
}

export interface WorkspaceSceneResponse {
  workspace: WorkspaceSceneWorkspace;
  scene: WorkspaceScene;
  summary: WorkspaceSceneSummary;
  agents: WorkspaceSceneAgent[];
  selectedAgent: WorkspaceSceneSelectedAgent | null;
  integrations?: WorkspaceSceneIntegrations;
  tasks?: WorkspaceSceneTaskSummary[];
  feed?: WorkspaceSceneFeedItem[];
  approvals?: WorkspaceSceneApprovalSummary[];
  holds?: WorkspaceSceneHoldSummary[];
}
