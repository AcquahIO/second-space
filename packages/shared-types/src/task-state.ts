import type { TaskStatus } from "./domain";

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["QUEUED", "CANCELLED"],
  QUEUED: ["ASSIGNED", "CANCELLED", "FAILED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "PENDING_APPROVAL", "FAILED", "CANCELLED"],
  IN_PROGRESS: ["ASSIGNED", "BLOCKED", "PENDING_APPROVAL", "DONE", "FAILED", "CANCELLED"],
  BLOCKED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED", "FAILED"],
  PENDING_APPROVAL: ["ASSIGNED", "IN_PROGRESS", "DONE", "FAILED", "CANCELLED"],
  DONE: [],
  FAILED: ["QUEUED", "CANCELLED"],
  CANCELLED: []
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal task transition: ${from} -> ${to}`);
  }
}

export const TASK_TRANSITIONS = TRANSITIONS;
