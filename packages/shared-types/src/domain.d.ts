export declare const AGENT_ROLES: readonly ["DIRECTOR", "MANAGER", "SPECIALIST"];
export type AgentRole = (typeof AGENT_ROLES)[number];
export declare const SPECIALIST_ROLES: readonly ["PROJECT_MANAGER", "TECH_LEAD", "SOFTWARE_ENGINEER", "QA_TESTER", "DEVOPS_ENGINEER", "CONTENT_AGENT", "MARKETING_AGENT", "FINANCE_AGENT", "CUSTOMER_SUPPORT_AGENT", "OPERATIONS_LOGISTICS_AGENT"];
export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];
export declare const AGENT_STATES: readonly ["IDLE", "MOVING", "WORKING", "MEETING", "BLOCKED"];
export type AgentState = (typeof AGENT_STATES)[number];
export declare const TASK_STATUSES: readonly ["DRAFT", "QUEUED", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "PENDING_APPROVAL", "DONE", "FAILED", "CANCELLED"];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export declare const EXECUTION_MODES: readonly ["REAL", "MOCK"];
export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export declare const APPROVAL_TYPES: readonly ["EXTERNAL_ACTION", "HIGH_RISK_ACTION"];
export type ApprovalType = (typeof APPROVAL_TYPES)[number];
export declare const WORKSPACE_ONBOARDING_STATES: readonly ["WORKSPACE_SETUP", "SUBSCRIPTION_ACTIVE", "KNOWLEDGE_IMPORT", "INTEGRATIONS_CONNECTED", "AGENTS_HIRED", "PERMISSIONS_REVIEWED", "LAUNCHED"];
export type WorkspaceOnboardingState = (typeof WORKSPACE_ONBOARDING_STATES)[number];
export declare const WORKSPACE_SUBSCRIPTION_STATUSES: readonly ["TRIALING", "ACTIVE", "PAST_DUE", "CANCELED"];
export type WorkspaceSubscriptionStatus = (typeof WORKSPACE_SUBSCRIPTION_STATUSES)[number];
export declare const INTEGRATION_PROVIDERS: readonly ["GITHUB", "LINKEDIN", "GMAIL"];
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export declare const INTEGRATION_AUTH_STATUSES: readonly ["DISCONNECTED", "CONNECTED", "ERROR"];
export type IntegrationAuthStatus = (typeof INTEGRATION_AUTH_STATUSES)[number];
export declare const INTEGRATION_CAPABILITIES: readonly ["READ", "WRITE", "POST", "SEND", "COMMIT", "PUSH"];
export type IntegrationCapability = (typeof INTEGRATION_CAPABILITIES)[number];
export declare const KNOWLEDGE_SOURCE_TYPES: readonly ["FILE", "URL", "NOTE"];
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];
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
