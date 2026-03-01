export const AGENT_ROLES = ["DIRECTOR", "MANAGER", "SPECIALIST"] as const;
export type AgentRole = (typeof AGENT_ROLES)[number];

export const SPECIALIST_ROLES = [
  "PROJECT_MANAGER",
  "TECH_LEAD",
  "SOFTWARE_ENGINEER",
  "QA_TESTER",
  "DEVOPS_ENGINEER",
  "SECURITY_AGENT",
  "CONTENT_AGENT",
  "MARKETING_AGENT",
  "FINANCE_AGENT",
  "CUSTOMER_SUPPORT_AGENT",
  "OPERATIONS_LOGISTICS_AGENT"
] as const;
export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];

export const AGENT_STATES = ["IDLE", "MOVING", "WORKING", "MEETING", "BLOCKED"] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export const TASK_STATUSES = [
  "DRAFT",
  "QUEUED",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "PENDING_APPROVAL",
  "DONE",
  "FAILED",
  "CANCELLED"
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EXECUTION_MODES = ["REAL", "MOCK"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const APPROVAL_TYPES = ["EXTERNAL_ACTION", "HIGH_RISK_ACTION"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const WORKSPACE_ONBOARDING_STATES = [
  "WORKSPACE_SETUP",
  "SUBSCRIPTION_ACTIVE",
  "KNOWLEDGE_IMPORT",
  "INTEGRATIONS_CONNECTED",
  "AGENTS_HIRED",
  "PERMISSIONS_REVIEWED",
  "LAUNCHED"
] as const;
export type WorkspaceOnboardingState = (typeof WORKSPACE_ONBOARDING_STATES)[number];

export const WORKSPACE_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"] as const;
export type WorkspaceSubscriptionStatus = (typeof WORKSPACE_SUBSCRIPTION_STATUSES)[number];

export const INTEGRATION_PROVIDERS = ["GITHUB", "LINKEDIN", "GMAIL"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_AUTH_STATUSES = ["DISCONNECTED", "CONNECTED", "ERROR"] as const;
export type IntegrationAuthStatus = (typeof INTEGRATION_AUTH_STATUSES)[number];

export const INTEGRATION_CAPABILITIES = ["READ", "WRITE", "POST", "SEND", "COMMIT", "PUSH"] as const;
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];

export const KNOWLEDGE_SOURCE_TYPES = ["FILE", "URL", "NOTE"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const SECURITY_HOLD_SCOPES = ["TASK", "WORKSPACE"] as const;
export type SecurityHoldScope = (typeof SECURITY_HOLD_SCOPES)[number];

export const SECURITY_HOLD_STATUSES = ["ACTIVE", "RELEASED"] as const;
export type SecurityHoldStatus = (typeof SECURITY_HOLD_STATUSES)[number];

export const RISK_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskSeverity = (typeof RISK_SEVERITIES)[number];

export const SECURITY_HOLD_SOURCES = ["AUTO_POLICY", "MANUAL"] as const;
export type SecurityHoldSource = (typeof SECURITY_HOLD_SOURCES)[number];

export const USER_CONTEXT_TYPES = [
  "GOAL",
  "PREFERENCE",
  "STRENGTH",
  "WEAKNESS",
  "BUSINESS_CONTEXT",
  "PRODUCT_CONTEXT",
  "WORKING_STYLE"
] as const;
export type UserContextType = (typeof USER_CONTEXT_TYPES)[number];

export const MEMORY_EVENT_TYPES = [
  "TASK_CREATED",
  "TASK_UPDATED",
  "TASK_COMPLETED",
  "TASK_FAILED",
  "APPROVAL_REQUESTED",
  "APPROVAL_RESOLVED",
  "TASK_HANDOFF",
  "CHAT_DIRECTIVE",
  "INTEGRATION_FAILURE",
  "SECURITY_HOLD",
  "REFLECTION_NOTE"
] as const;
export type MemoryEventType = (typeof MEMORY_EVENT_TYPES)[number];

export const CONTRACT_PROPOSAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ContractProposalStatus = (typeof CONTRACT_PROPOSAL_STATUSES)[number];

export const MEMORY_RETENTION_POLICY = {
  rawEventRetentionDays: 180,
  minWorkspaceAgeDaysForReflection: 14,
  minEventsForReflection: 25
} as const;
export type MemoryRetentionPolicy = typeof MEMORY_RETENTION_POLICY;

export const COMMAND_MODES = ["explore", "plan", "execute", "review"] as const;
export type CommandMode = (typeof COMMAND_MODES)[number];

export type Mood = "FOCUSED" | "NEUTRAL" | "STRESSED";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  onboardingState: WorkspaceOnboardingState;
  onboardingCompletedAt?: string | null;
}

export interface WorkspaceSubscription {
  id: string;
  workspaceId: string;
  status: WorkspaceSubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface Agent {
  id: string;
  workspaceId: string;
  name: string;
  role: AgentRole;
  specialistRole: SpecialistRole;
  managerId: string | null;
  specialty: string;
  state: AgentState;
  toolIds: string[];
}

export interface AgentStats {
  workspaceId: string;
  agentId: string;
  xp: number;
  level: number;
  mood: Mood;
  badges: string[];
  streak: number;
}

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string;
  createdById: string;
  parentTaskId?: string | null;
  requiresApproval: boolean;
  externalAction: boolean;
  toolName?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Approval {
  id: string;
  workspaceId: string;
  taskId: string;
  type: ApprovalType;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface TaskEvent {
  id: string;
  workspaceId: string;
  taskId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ToolExecutionInput {
  prompt: string;
  taskId: string;
  workspaceId: string;
  agentId: string;
  context?: Record<string, unknown>;
}

export interface AdapterResult {
  ok: boolean;
  output: string;
  raw?: unknown;
  error?: string;
}

export interface ToolBinding {
  id: string;
  name: string;
  provider: string;
  executionMode: ExecutionMode;
  execute(input: ToolExecutionInput): Promise<AdapterResult>;
}

export interface ProposedTask {
  title: string;
  description: string;
  assigneeRole?: AgentRole;
  assigneeSpecialistRole?: SpecialistRole;
  requiresApproval: boolean;
  externalAction: boolean;
  toolName?: string;
  parentIndex?: number;
  metadata?: Record<string, unknown>;
}

export interface CommandDraft {
  id: string;
  workspaceId: string;
  rawText: string;
  intent: string;
  mode: CommandMode;
  proposedTasks: ProposedTask[];
  createdAt: string;
}

export interface WorkspaceIntegration {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  authStatus: IntegrationAuthStatus;
  accountLabel?: string | null;
  capabilities: IntegrationCapability[];
  expiresAt?: string | null;
  tokenMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentIntegrationPermission {
  id: string;
  workspaceIntegrationId: string;
  agentId: string;
  capabilities: IntegrationCapability[];
}

export interface KnowledgeSource {
  id: string;
  workspaceId: string;
  type: KnowledgeSourceType;
  title: string;
  sourceUrl?: string | null;
  filePath?: string | null;
  rawContent: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  workspaceId: string;
  sourceId: string;
  chunkIndex: number;
  content: string;
  embedding?: number[] | null;
}

export interface ScheduleSpec {
  recurrence: string;
  timezone: string;
  nextRunAt?: string | null;
}

export interface Schedule {
  id: string;
  workspaceId: string;
  leadAgentId?: string | null;
  name: string;
  prompt: string;
  naturalLanguage: string;
  recurrence: string;
  timezone: string;
  enabled: boolean;
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface SecurityHold {
  id: string;
  workspaceId: string;
  taskId?: string | null;
  scope: SecurityHoldScope;
  severity: RiskSeverity;
  source: SecurityHoldSource;
  status: SecurityHoldStatus;
  reason: string;
  metadata?: Record<string, unknown> | null;
  createdByAgentId?: string | null;
  releasedByUserId?: string | null;
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserContext {
  id: string;
  workspaceId: string;
  type: UserContextType;
  title: string;
  content: string;
  weight: number;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEvent {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  taskId?: string | null;
  eventType: MemoryEventType;
  content: string;
  metadata?: Record<string, unknown> | null;
  redacted: boolean;
  createdAt: string;
}

export interface LearningReflectionRun {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  status: "PENDING" | "COMPLETED" | "FAILED";
  summary: string;
  analyzedEventCount: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractProposal {
  id: string;
  workspaceId: string;
  agentId?: string | null;
  status: ContractProposalStatus;
  title: string;
  rationale: string;
  currentContract: Record<string, unknown>;
  proposedContract: Record<string, unknown>;
  proposedByRunId?: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
