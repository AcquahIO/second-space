import type { AgentState, TaskStatus, WorkspaceOnboardingState, IntegrationProvider } from "./domain";
export type RealtimeEventName = "sim.agent.position.updated" | "sim.agent.state.updated" | "task.created" | "task.updated" | "task.handoff.requested" | "approval.requested" | "approval.resolved" | "approval.queue.updated" | "feed.event" | "onboarding.step.completed" | "integration.connected" | "integration.connection_failed" | "schedule.triggered";
export interface RealtimeEvent<T = unknown> {
    type: RealtimeEventName;
    payload: T;
    emittedAt: string;
}
export interface PositionPayload {
    agentId: string;
    x: number;
    y: number;
}
export interface AgentStatePayload {
    agentId: string;
    state: AgentState;
}
export interface TaskPayload {
    taskId: string;
    status: TaskStatus;
    assigneeId: string;
    title: string;
}
export interface HandoffPayload {
    taskId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
}
export interface ApprovalPayload {
    approvalId: string;
    taskId: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
}
export interface FeedPayload {
    id: string;
    message: string;
    category: "TASK" | "APPROVAL" | "SIM" | "SYSTEM";
    createdAt: string;
}
export interface OnboardingStepCompletedPayload {
    workspaceId: string;
    step: WorkspaceOnboardingState;
    completedAt: string;
}
export interface IntegrationConnectedPayload {
    workspaceId: string;
    provider: IntegrationProvider;
    connectedAt: string;
}
export interface IntegrationConnectionFailedPayload {
    workspaceId: string;
    provider: IntegrationProvider;
    reason: string;
    failedAt: string;
}
export interface ScheduleTriggeredPayload {
    scheduleId: string;
    workspaceId: string;
    taskCount: number;
    triggeredAt: string;
}
export interface ApprovalQueueUpdatedPayload {
    workspaceId: string;
    pendingCount: number;
    updatedAt: string;
}
