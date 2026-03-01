import type { TaskStatus } from "./domain";
export declare function canTransition(from: TaskStatus, to: TaskStatus): boolean;
export declare function assertTaskTransition(from: TaskStatus, to: TaskStatus): void;
export declare const TASK_TRANSITIONS: Record<"BLOCKED" | "DRAFT" | "QUEUED" | "ASSIGNED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "DONE" | "FAILED" | "CANCELLED", ("BLOCKED" | "DRAFT" | "QUEUED" | "ASSIGNED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "DONE" | "FAILED" | "CANCELLED")[]>;
