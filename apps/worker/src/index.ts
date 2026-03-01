import "dotenv/config";
import { PrismaClient, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";
import { createToolAdapter } from "@second-space/tool-adapters";
import { getWaypoint, tickAgents, waypointForTaskStatus } from "@second-space/sim-engine";
import { applyTaskCompletionProgress, type SpecialistRole } from "@second-space/shared-types";
import type {
  AgentState,
  IntegrationCapability,
  MemoryEventType,
  PresentationChannel,
  PresentationSceneEvent,
  PresentationScenePatch,
  PresentationTokenPayload,
  RealtimeEvent
} from "@second-space/shared-types";
import { verifyPresentationToken } from "@second-space/shared-types/token-signing";
import type { WaypointName } from "@second-space/sim-engine";
import {
  buildContractPrompt,
  buildLongTermMemorySummary,
  buildUserContextSummary,
  purgeExpiredMemoryEvents,
  recordMemoryEvent
} from "./learning/memory";
import { runReflectionCycle } from "./learning/reflection";
import { buildPresentationPatchForEvent, resolveWorkspaceIdForRealtimeEvent } from "./presentation/events";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
const redisSub = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });

const TASK_EXECUTION_QUEUE = "task-execution";
const REALTIME_CHANNEL = "realtime-events";
const wsPort = Number(process.env.WORKER_PORT ?? 4001);
const simTickMs = Number(process.env.SIM_TICK_MS ?? 1000);
const scheduleTickMs = Number(process.env.SCHEDULE_TICK_MS ?? 30000);
const ambientPatrolEnabled = (process.env.SIM_AMBIENT_PATROL ?? "false").toLowerCase() === "true";

const wss = new WebSocketServer({ port: wsPort });
const taskQueue = new Queue(TASK_EXECUTION_QUEUE, {
  connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })
});
const socketContexts = new WeakMap<WebSocket, PresentationTokenPayload>();

const ambientWaypointPool: WaypointName[] = [
  "directorDesk",
  "managerDeskA",
  "managerDeskB",
  "specialistPodA",
  "specialistPodB",
  "meetingRoom",
  "breakArea",
  "lobby"
];

const ambientRoutes = new Map<string, { waypoint: WaypointName; nextMoveAt: number }>();

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseAmbientWaypoint(previous?: WaypointName): WaypointName {
  const options = ambientWaypointPool.filter((waypoint) => waypoint !== previous);
  return options[randomInt(0, options.length - 1)] ?? "lobby";
}

function idleStateForWaypoint(waypoint: WaypointName): AgentState {
  if (waypoint === "meetingRoom") {
    return "MEETING";
  }

  if (waypoint === "breakArea" || waypoint === "lobby") {
    return "IDLE";
  }

  return "WORKING";
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET?.trim()) {
    return process.env.SESSION_SECRET.trim();
  }

  if (process.env.NODE_ENV !== "production") {
    return "second-space-development-session-secret";
  }

  throw new Error("SESSION_SECRET is required");
}

function parsePresentationToken(requestUrl: string | undefined): string | undefined {
  if (!requestUrl) {
    return undefined;
  }

  try {
    const url = new URL(requestUrl, `ws://localhost:${wsPort}`);
    return url.searchParams.get("token") ?? undefined;
  } catch {
    return undefined;
  }
}

function getSocketContext(socket: WebSocket): PresentationTokenPayload | null {
  return socketContexts.get(socket) ?? null;
}

function broadcastScopedEvent(event: RealtimeEvent, workspaceId: string) {
  const payload = JSON.stringify(event);

  for (const client of wss.clients) {
    const context = getSocketContext(client as WebSocket);
    if (!context || context.workspaceId !== workspaceId) {
      continue;
    }

    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastPresentationPatch(workspaceId: string, changes: PresentationScenePatch) {
  const emittedAt = new Date().toISOString();

  for (const client of wss.clients) {
    const context = getSocketContext(client as WebSocket);
    if (!context || context.workspaceId !== workspaceId || client.readyState !== WebSocket.OPEN) {
      continue;
    }

    const event: PresentationSceneEvent = {
      type: "presentation.scene.patch",
      payload: {
        workspaceId,
        channel: context.channel as PresentationChannel,
        changes
      },
      emittedAt
    };

    client.send(JSON.stringify(event));
  }
}

async function publish(type: RealtimeEvent["type"], payload: Record<string, unknown>) {
  const event: RealtimeEvent = {
    type,
    payload,
    emittedAt: new Date().toISOString()
  };

  await redis.publish(REALTIME_CHANNEL, JSON.stringify(event));
}

async function appendTaskEvent(
  workspaceId: string,
  taskId: string,
  type: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  await prisma.taskEvent.create({
    data: {
      workspaceId,
      taskId,
      type,
      message,
      metadata: metadata as Prisma.InputJsonValue | undefined
    }
  });

  await publish("feed.event", {
    workspaceId,
    id: `${taskId}:${type}:${Date.now()}`,
    message,
    category: "TASK",
    createdAt: new Date().toISOString()
  });

  const mappedType: MemoryEventType =
    type === "TASK_CREATED"
      ? "TASK_CREATED"
      : type === "TASK_DONE"
        ? "TASK_COMPLETED"
        : type === "TASK_FAILED"
          ? "TASK_FAILED"
          : type === "APPROVAL_REQUESTED"
            ? "APPROVAL_REQUESTED"
            : type === "TASK_HANDOFF"
              ? "TASK_HANDOFF"
              : "TASK_UPDATED";

  await recordMemoryEvent(prisma, {
    workspaceId,
    taskId,
    eventType: mappedType,
    content: `${type}: ${message}`,
    metadata
  });
}

function detectWriteAction(text: string): boolean {
  return /(send|email|post|publish|commit|push|deploy|notify|message)/i.test(text);
}

function inferRequiredCapability(provider: string, text: string): IntegrationCapability {
  const lower = text.toLowerCase();

  if (provider === "github") {
    if (lower.includes("push")) {
      return "PUSH";
    }

    if (lower.includes("commit")) {
      return "COMMIT";
    }

    return "WRITE";
  }

  if (provider === "linkedin") {
    return lower.includes("post") || lower.includes("publish") ? "POST" : "READ";
  }

  if (provider === "gmail") {
    return lower.includes("send") || lower.includes("email") ? "SEND" : "READ";
  }

  return "READ";
}

function inferSecurityViolation(task: {
  title: string;
  description: string;
  metadata: Prisma.JsonValue | null;
  toolName: string | null;
}): { severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; reason: string } | null {
  const combined = `${task.title}\n${task.description}`.toLowerCase();
  const targetBranch =
    typeof task.metadata === "object" && task.metadata
      ? String((task.metadata as Record<string, unknown>).targetBranch ?? "")
      : "";

  if (/\b(sk-[a-z0-9]{20,}|gh[pousr]_[a-z0-9]{20,}|bearer\s+[a-z0-9._-]{10,})\b/i.test(combined)) {
    return {
      severity: "CRITICAL",
      reason: "Potential secret/token pattern detected in task prompt"
    };
  }

  if (task.toolName?.toLowerCase().includes("github")) {
    if (targetBranch && ["main", "master"].includes(targetBranch.toLowerCase())) {
      return {
        severity: "CRITICAL",
        reason: `Protected branch target detected (${targetBranch})`
      };
    }
  }

  if (/(disable.*monitor|bypass.*approval|override.*policy)/i.test(combined)) {
    return {
      severity: "HIGH",
      reason: "Task language indicates possible policy bypass intent"
    };
  }

  return null;
}

async function hasActiveSecurityHold(workspaceId: string, taskId: string | null) {
  const where = {
    workspaceId,
    status: "ACTIVE" as const,
    OR: [
      {
        scope: "WORKSPACE" as const
      },
      ...(taskId
        ? [
            {
              scope: "TASK" as const,
              taskId
            }
          ]
        : [])
    ]
  };

  const hold = await prisma.securityHold.findFirst({
    where,
    orderBy: {
      createdAt: "desc"
    }
  });

  return hold;
}

async function placeSecurityHold(input: {
  workspaceId: string;
  taskId?: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  createdByAgentId?: string | null;
  source?: "AUTO_POLICY" | "MANUAL";
}) {
  const existing = await prisma.securityHold.findFirst({
    where: {
      workspaceId: input.workspaceId,
      taskId: input.taskId ?? null,
      status: "ACTIVE",
      reason: input.reason
    },
    select: {
      id: true
    }
  });

  if (existing) {
    return existing.id;
  }

  const hold = await prisma.$transaction(async (tx) => {
    const created = await tx.securityHold.create({
      data: {
        workspaceId: input.workspaceId,
        taskId: input.taskId ?? null,
        scope: input.severity === "CRITICAL" && !input.taskId ? "WORKSPACE" : input.taskId ? "TASK" : "WORKSPACE",
        severity: input.severity,
        source: input.source ?? "AUTO_POLICY",
        reason: input.reason,
        createdByAgentId: input.createdByAgentId ?? null
      }
    });

    if (input.taskId) {
      await tx.task.updateMany({
        where: {
          id: input.taskId,
          workspaceId: input.workspaceId
        },
        data: {
          status: "BLOCKED"
        }
      });
    } else {
      await tx.task.updateMany({
        where: {
          workspaceId: input.workspaceId,
          externalAction: true,
          status: {
            in: ["ASSIGNED", "IN_PROGRESS", "QUEUED", "PENDING_APPROVAL"]
          }
        },
        data: {
          status: "BLOCKED"
        }
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        action: "SECURITY_HOLD_AUTO_PLACED",
        target: created.id,
        metadata: {
          severity: created.severity,
          scope: created.scope,
          taskId: input.taskId ?? null,
          reason: input.reason
        }
      }
    });

    return created;
  });

  await publish("security.hold.placed", {
    holdId: hold.id,
    workspaceId: hold.workspaceId,
    taskId: hold.taskId,
    scope: hold.scope,
    status: hold.status,
    severity: hold.severity,
    reason: hold.reason
  });

  await publish("feed.event", {
    workspaceId: hold.workspaceId,
    id: `${hold.id}:security-hold`,
    message: `Security hold placed: ${hold.reason}`,
    category: "APPROVAL",
    createdAt: new Date().toISOString()
  });

  await recordMemoryEvent(prisma, {
    workspaceId: hold.workspaceId,
    taskId: hold.taskId,
    agentId: input.createdByAgentId ?? null,
    eventType: "SECURITY_HOLD",
    content: `Security hold placed (${hold.scope}, ${hold.severity}): ${hold.reason}`
  });

  return hold.id;
}

function nextRunFromRecurrence(recurrence: string, now = new Date()): Date {
  const parts = recurrence.split(";").map((part) => part.trim());
  const values = new Map<string, string>();

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key && value) {
      values.set(key, value);
    }
  }

  const freq = values.get("FREQ");
  if (freq === "HOURLY") {
    const interval = Math.max(1, Number(values.get("INTERVAL") ?? "1"));
    return new Date(now.getTime() + interval * 60 * 60 * 1000);
  }

  const byHour = Number(values.get("BYHOUR") ?? "9");
  const byMinute = Number(values.get("BYMINUTE") ?? "0");
  const byDay = (values.get("BYDAY") ?? "MO,TU,WE,TH,FR")
    .split(",")
    .map((day) => day.trim())
    .map((day) => {
      switch (day) {
        case "MO":
          return 1;
        case "TU":
          return 2;
        case "WE":
          return 3;
        case "TH":
          return 4;
        case "FR":
          return 5;
        case "SA":
          return 6;
        case "SU":
          return 0;
        default:
          return -1;
      }
    })
    .filter((value) => value >= 0);

  const days = byDay.length ? byDay : [1, 2, 3, 4, 5];

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(byHour, byMinute, 0, 0);

    if (days.includes(candidate.getDay()) && candidate > now) {
      return candidate;
    }
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

async function buildKnowledgeContext(workspaceId: string, prompt: string): Promise<string> {
  const words = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 20);

  if (!words.length) {
    return "";
  }

  const chunks = await prisma.knowledgeChunk.findMany({
    where: {
      workspaceId
    },
    take: 120,
    orderBy: {
      createdAt: "desc"
    }
  });

  const scored = chunks
    .map((chunk) => {
      const lowered = chunk.content.toLowerCase();
      const score = words.reduce((acc, word) => acc + (lowered.includes(word) ? 1 : 0), 0);
      return {
        score,
        content: chunk.content
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((chunk) => chunk.content);

  return scored.join("\n\n---\n\n");
}

async function ensureApprovalForWriteActions(taskId: string): Promise<"READY" | "PENDING"> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      approvals: true
    }
  });

  if (!task) {
    return "PENDING";
  }

  const writeAction = task.externalAction || task.requiresApproval || detectWriteAction(`${task.title} ${task.description}`);
  if (!writeAction) {
    return "READY";
  }

  const approved = task.approvals.some((approval) => approval.status === "APPROVED");
  if (approved) {
    return "READY";
  }

  const pending = task.approvals.find((approval) => approval.status === "PENDING");

  if (!pending) {
    const approval = await prisma.$transaction(async (tx) => {
      const created = await tx.approval.create({
        data: {
          workspaceId: task.workspaceId,
          taskId: task.id,
          type: "EXTERNAL_ACTION",
          reason: "Write actions require explicit approval"
        }
      });

      await tx.task.update({
        where: { id: task.id },
        data: {
          status: "PENDING_APPROVAL"
        }
      });

      await tx.taskEvent.create({
        data: {
          workspaceId: task.workspaceId,
          taskId: task.id,
          type: "APPROVAL_REQUESTED",
          message: "Write action blocked pending human approval",
          metadata: {
            approvalId: created.id
          }
        }
      });

      return created;
    });

    await publish("approval.requested", {
      workspaceId: task.workspaceId,
      approvalId: approval.id,
      taskId: task.id,
      status: "PENDING"
    });

    await publish("task.updated", {
      workspaceId: task.workspaceId,
      taskId: task.id,
      status: "PENDING_APPROVAL",
      assigneeId: task.assigneeId,
      title: task.title
    });

    await publish("approval.queue.updated", {
      workspaceId: task.workspaceId,
      pendingCount: await prisma.approval.count({
        where: {
          workspaceId: task.workspaceId,
          status: "PENDING"
        }
      }),
      updatedAt: new Date().toISOString()
    });

    await recordMemoryEvent(prisma, {
      workspaceId: task.workspaceId,
      taskId: task.id,
      agentId: task.assigneeId,
      eventType: "APPROVAL_REQUESTED",
      content: `Approval requested for write action on task ${task.title}`
    });
  }

  return "PENDING";
}

async function processTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: {
        include: {
          tools: {
            include: {
              tool: true
            }
          }
        }
      },
      approvals: true
    }
  });

  if (!task) {
    return;
  }

  if (["DONE", "FAILED", "CANCELLED"].includes(task.status)) {
    return;
  }

  const activeHold = await hasActiveSecurityHold(task.workspaceId, task.id);
  if (activeHold) {
    if (task.status !== "BLOCKED") {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "BLOCKED" }
      });

      await appendTaskEvent(task.workspaceId, task.id, "TASK_STATUS", `Task blocked by active security hold (${activeHold.id})`, {
        holdId: activeHold.id
      });
      await publish("task.updated", {
        workspaceId: task.workspaceId,
        taskId: task.id,
        status: "BLOCKED",
        assigneeId: task.assigneeId,
        title: task.title
      });
    }

    return;
  }

  const securityViolation = inferSecurityViolation(task);
  if (securityViolation) {
    await placeSecurityHold({
      workspaceId: task.workspaceId,
      taskId: task.id,
      severity: securityViolation.severity,
      reason: securityViolation.reason
    });

    await appendTaskEvent(task.workspaceId, task.id, "TASK_STATUS", "Task blocked by Security precheck", {
      severity: securityViolation.severity,
      reason: securityViolation.reason
    });
    await publish("task.updated", {
      workspaceId: task.workspaceId,
      taskId: task.id,
      status: "BLOCKED",
      assigneeId: task.assigneeId,
      title: task.title
    });

    return;
  }

  const approvalState = await ensureApprovalForWriteActions(taskId);
  if (approvalState === "PENDING") {
    return;
  }

  if (["ASSIGNED", "QUEUED", "BLOCKED"].includes(task.status)) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS"
      }
    });

    await appendTaskEvent(task.workspaceId, taskId, "TASK_STATUS", "Task moved to IN_PROGRESS", { status: "IN_PROGRESS" });
    await publish("task.updated", {
      workspaceId: task.workspaceId,
      taskId,
      status: "IN_PROGRESS",
      assigneeId: task.assigneeId,
      title: task.title
    });
  }

  const selectedTool =
    task.assignee.tools.find((binding) => binding.tool.name === task.toolName) ??
    task.assignee.tools.find((binding) => binding.tool.provider === "openai") ??
    task.assignee.tools[0];

  if (!selectedTool) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "FAILED"
      }
    });
    await appendTaskEvent(task.workspaceId, taskId, "TASK_FAILED", "No tool binding found for task assignee");
    await publish("task.updated", {
      workspaceId: task.workspaceId,
      taskId,
      status: "FAILED",
      assigneeId: task.assigneeId,
      title: task.title
    });
    return;
  }

  let integrationConfig: Record<string, unknown> = {};
  const provider = selectedTool.tool.provider.toLowerCase();

  if (["github", "linkedin", "gmail"].includes(provider)) {
    const workspaceIntegration = await prisma.workspaceIntegration.findFirst({
      where: {
        workspaceId: task.workspaceId,
        provider: provider.toUpperCase() as "GITHUB" | "LINKEDIN" | "GMAIL"
      },
      include: {
        agentPermissions: {
          where: {
            agentId: task.assigneeId
          }
        }
      }
    });

    if (!workspaceIntegration || workspaceIntegration.authStatus !== "CONNECTED") {
      if (provider !== "linkedin") {
        await placeSecurityHold({
          workspaceId: task.workspaceId,
          taskId: task.id,
          severity: "HIGH",
          reason: `Workspace integration not connected for ${provider}`
        });

        await appendTaskEvent(task.workspaceId, taskId, "TASK_STATUS", `${provider} integration not connected; task blocked`, {
          provider
        });
        await publish("task.updated", {
          workspaceId: task.workspaceId,
          taskId,
          status: "BLOCKED",
          assigneeId: task.assigneeId,
          title: task.title
        });

        await publish("integration.connection_failed", {
          workspaceId: task.workspaceId,
          provider: provider.toUpperCase(),
          reason: `${provider} integration not connected`,
          failedAt: new Date().toISOString()
        });

        await recordMemoryEvent(prisma, {
          workspaceId: task.workspaceId,
          taskId: task.id,
          agentId: task.assigneeId,
          eventType: "INTEGRATION_FAILURE",
          content: `Integration failure for ${provider}: not connected`
        });
        return;
      }

      integrationConfig = {
        postingEnabled: false
      };
    } else {
      const requiredCapability = inferRequiredCapability(provider, `${task.title} ${task.description}`);
      const permissions = workspaceIntegration.agentPermissions[0]?.capabilities ?? [];

      if (requiredCapability !== "READ" && !permissions.includes(requiredCapability)) {
        await placeSecurityHold({
          workspaceId: task.workspaceId,
          taskId: task.id,
          severity: "CRITICAL",
          reason: `Permission denied: ${requiredCapability} missing for ${provider}`
        });

        await appendTaskEvent(
          task.workspaceId,
          taskId,
          "TASK_STATUS",
          `Permission denied: ${requiredCapability} not granted for ${provider}`
        );

        await publish("task.updated", {
          workspaceId: task.workspaceId,
          taskId,
          status: "BLOCKED",
          assigneeId: task.assigneeId,
          title: task.title
        });

        await recordMemoryEvent(prisma, {
          workspaceId: task.workspaceId,
          taskId: task.id,
          agentId: task.assigneeId,
          eventType: "SECURITY_HOLD",
          content: `Security hold due to missing ${requiredCapability} permission for ${provider}`
        });

        return;
      }

      integrationConfig = {
        defaultBranch:
          typeof workspaceIntegration.tokenMetadata === "object" && workspaceIntegration.tokenMetadata
            ? ((workspaceIntegration.tokenMetadata as Record<string, unknown>).defaultBranch ?? "main")
            : "main",
        postingEnabled:
          provider === "linkedin"
            ? !Boolean((workspaceIntegration.tokenMetadata as Record<string, unknown> | null)?.linkedInPostingFallback)
            : true
      };
    }
  }

  const contractPrompt = await buildContractPrompt(prisma, {
    workspaceId: task.workspaceId,
    agentId: task.assigneeId,
    specialistRole: task.assignee.specialistRole as SpecialistRole
  });
  const userContextSummary = await buildUserContextSummary(prisma, task.workspaceId);
  const longTermMemorySummary = await buildLongTermMemorySummary(prisma, task.workspaceId, task.assigneeId);
  const adapter = createToolAdapter({
    toolId: selectedTool.tool.id,
    toolName: selectedTool.tool.name,
    provider: selectedTool.tool.provider,
    executionMode: selectedTool.tool.executionMode,
    config: {
      ...(((selectedTool.tool.config as Record<string, unknown> | null) ?? {}) as Record<string, unknown>),
      ...integrationConfig
    }
  });

  const knowledgeContext = await buildKnowledgeContext(task.workspaceId, `${task.title}\n\n${task.description}`);
  const promptSections = [
    knowledgeContext ? `[Workspace Knowledge]\n${knowledgeContext}` : "",
    `[Task]\n${task.title}\n\n${task.description}`
  ].filter(Boolean);
  const prompt = promptSections.join("\n\n");
  const systemInstruction = [
    contractPrompt,
    userContextSummary ? `[User Context]\n${userContextSummary}` : "",
    longTermMemorySummary ? `[Agent Long-term Memory]\n${longTermMemorySummary}` : "",
    "[Guardrails]",
    "Follow approval gates for all external writes.",
    "Never expose plaintext tokens or secrets.",
    "Escalate to Security hold when critical risk is detected."
  ]
    .filter(Boolean)
    .join("\n\n");

  await recordMemoryEvent(prisma, {
    workspaceId: task.workspaceId,
    taskId: task.id,
    agentId: task.assigneeId,
    eventType: "TASK_UPDATED",
    content: `Execution started for task ${task.title} using ${selectedTool.tool.provider}`,
    metadata: {
      toolName: selectedTool.tool.name,
      provider: selectedTool.tool.provider
    }
  });

  const result = await adapter.execute({
    taskId: task.id,
    workspaceId: task.workspaceId,
    agentId: task.assigneeId,
    prompt,
    context: {
      systemInstruction,
      toolName: selectedTool.tool.name,
      provider: selectedTool.tool.provider,
      targetBranch: typeof task.metadata === "object" && task.metadata ? (task.metadata as Record<string, unknown>).targetBranch : null
    }
  });

  if (!result.ok) {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        metadata: {
          ...(((task.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>),
          error: result.error ?? "Execution failed"
        }
      }
    });

    await appendTaskEvent(task.workspaceId, taskId, "TASK_FAILED", result.error ?? "Execution failed");
    await recordMemoryEvent(prisma, {
      workspaceId: task.workspaceId,
      taskId: task.id,
      agentId: task.assigneeId,
      eventType: "TASK_FAILED",
      content: `Task execution failed: ${result.error ?? "Execution failed"}`
    });

    await publish("task.updated", {
      workspaceId: task.workspaceId,
      taskId,
      status: "FAILED",
      assigneeId: task.assigneeId,
      title: task.title
    });

    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: taskId },
      data: {
        status: "DONE",
        metadata: {
          ...(((task.metadata as Record<string, unknown> | null) ?? {}) as Record<string, unknown>),
          output: result.output,
          adapterRaw: result.raw ?? null,
          completedAt: new Date().toISOString(),
          usedKnowledgeContext: Boolean(knowledgeContext)
        }
      }
    });

    await tx.taskEvent.create({
      data: {
        workspaceId: task.workspaceId,
        taskId,
        type: "TASK_DONE",
        message: `Task completed by ${task.assignee.name}`,
        metadata: {
          provider: selectedTool.tool.provider,
          toolName: selectedTool.tool.name
        }
      }
    });

    const currentStats = await tx.agentStats.findUnique({ where: { agentId: task.assigneeId } });

    if (currentStats) {
      const nextProgress = applyTaskCompletionProgress({
        xp: currentStats.xp,
        streak: currentStats.streak,
        level: currentStats.level,
        mood: currentStats.mood,
        badges: Array.isArray(currentStats.badges) ? (currentStats.badges as string[]) : []
      });

      await tx.agentStats.update({
        where: { agentId: task.assigneeId },
        data: {
          xp: nextProgress.xp,
          level: nextProgress.level,
          streak: nextProgress.streak,
          mood: nextProgress.mood,
          badges: nextProgress.badges
        }
      });
    }

    await tx.agent.update({
      where: { id: task.assigneeId },
      data: {
        state: "IDLE"
      }
    });
  });

  await publish("task.updated", {
    workspaceId: task.workspaceId,
    taskId,
    status: "DONE",
    assigneeId: task.assigneeId,
    title: task.title
  });

  await publish("sim.agent.state.updated", {
    workspaceId: task.workspaceId,
    agentId: task.assigneeId,
    state: "IDLE"
  });

  await publish("feed.event", {
    workspaceId: task.workspaceId,
    id: `${task.id}:done`,
    message: `${task.title} completed by ${task.assignee.name}`,
    category: "TASK",
    createdAt: new Date().toISOString()
  });

  await recordMemoryEvent(prisma, {
    workspaceId: task.workspaceId,
    taskId: task.id,
    agentId: task.assigneeId,
    eventType: "TASK_COMPLETED",
    content: `Task completed: ${task.title}. Output sample: ${result.output.slice(0, 400)}`
  });
}

async function scheduleTick() {
  const now = new Date();
  const dueSchedules = await prisma.schedule.findMany({
    where: {
      enabled: true,
      nextRunAt: {
        lte: now
      }
    },
    include: {
      leadAgent: {
        select: {
          id: true,
          name: true
        }
      }
    },
    take: 30
  });

  for (const schedule of dueSchedules) {
    const scheduleMetadata =
      typeof schedule.metadata === "object" && schedule.metadata ? (schedule.metadata as Record<string, unknown>) : {};
    const isReflectionSchedule = scheduleMetadata.type === "LEARNING_REFLECTION";

    if (isReflectionSchedule) {
      await runReflectionCycle(prisma, publish);
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRunFromRecurrence(schedule.recurrence, now)
        }
      });

      await publish("schedule.triggered", {
        scheduleId: schedule.id,
        workspaceId: schedule.workspaceId,
        taskCount: 0,
        triggeredAt: now.toISOString()
      });

      continue;
    }

    const leadAgent =
      schedule.leadAgent ??
      (await prisma.agent.findFirst({
        where: {
          workspaceId: schedule.workspaceId,
          specialistRole: "PROJECT_MANAGER"
        },
        select: {
          id: true,
          name: true
        }
      }));

    if (!leadAgent) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: {
          nextRunAt: nextRunFromRecurrence(schedule.recurrence, now)
        }
      });
      continue;
    }

    const requiresApproval = detectWriteAction(schedule.prompt);
    const status: TaskStatus = requiresApproval ? "PENDING_APPROVAL" : "ASSIGNED";

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          workspaceId: schedule.workspaceId,
          title: schedule.name,
          description: schedule.prompt,
          status,
          assigneeId: leadAgent.id,
          createdById: leadAgent.id,
          requiresApproval,
          externalAction: requiresApproval,
          toolName: "OpenAI Core",
          metadata: {
            scheduleId: schedule.id,
            scheduled: true,
            triggerTime: now.toISOString()
          }
        }
      });

      await tx.conversation.create({
        data: {
          workspaceId: schedule.workspaceId,
          taskId: created.id
        }
      });

      await tx.taskEvent.create({
        data: {
          workspaceId: schedule.workspaceId,
          taskId: created.id,
          type: "TASK_CREATED",
          message: `Scheduled mission created by ${schedule.name}`
        }
      });

      if (requiresApproval) {
        await tx.approval.create({
          data: {
            workspaceId: schedule.workspaceId,
            taskId: created.id,
            type: "EXTERNAL_ACTION",
            reason: "Scheduled write mission requires explicit approval"
          }
        });
      }

      await tx.schedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          nextRunAt: nextRunFromRecurrence(schedule.recurrence, now)
        }
      });

      await tx.auditLog.create({
        data: {
          workspaceId: schedule.workspaceId,
          action: "SCHEDULE_TRIGGERED",
          target: schedule.id,
          metadata: {
            taskId: created.id
          }
        }
      });

      return created;
    });

    await publish("schedule.triggered", {
      scheduleId: schedule.id,
      workspaceId: schedule.workspaceId,
      taskCount: 1,
      triggeredAt: now.toISOString()
    });

    await publish("task.created", {
      workspaceId: schedule.workspaceId,
      taskId: task.id,
      status: task.status,
      assigneeId: task.assigneeId,
      title: task.title
    });

    if (task.status !== "PENDING_APPROVAL") {
      await taskQueue.add("execute-task", { taskId: task.id });
    } else {
      await publish("approval.requested", {
        workspaceId: schedule.workspaceId,
        approvalId: `task:${task.id}`,
        taskId: task.id,
        status: "PENDING"
      });
    }
  }

  await purgeExpiredMemoryEvents(prisma);
}

async function simulationTick() {
  const [agents, activeTasks] = await Promise.all([
    prisma.agent.findMany({
      include: {
        simPosition: true
      }
    }),
    prisma.task.findMany({
      where: {
        status: {
          in: ["ASSIGNED", "IN_PROGRESS", "BLOCKED", "PENDING_APPROVAL"]
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    })
  ]);

  const taskByAssignee = new Map<string, TaskStatus>();
  for (const task of activeTasks) {
    if (!taskByAssignee.has(task.assigneeId)) {
      taskByAssignee.set(task.assigneeId, task.status);
    }
  }

  const now = Date.now();
  const targetWaypointByAgent = new Map<string, WaypointName | null>();

  const simInput = agents.map((agent) => {
    const status = taskByAssignee.get(agent.id);
    let waypointName: WaypointName | null = null;
    let targetX = agent.simPosition?.x ?? 100;
    let targetY = agent.simPosition?.y ?? 100;

    if (status) {
      waypointName = waypointForTaskStatus(status);
    } else if (ambientPatrolEnabled) {
      const positionX = agent.simPosition?.x ?? 100;
      const positionY = agent.simPosition?.y ?? 100;
      const currentRoute = ambientRoutes.get(agent.id);
      const activeRoute = currentRoute ?? {
        waypoint: chooseAmbientWaypoint(),
        nextMoveAt: now + randomInt(3000, 9000)
      };

      const currentWaypoint = getWaypoint(activeRoute.waypoint);
      const distance = Math.hypot(positionX - currentWaypoint.x, positionY - currentWaypoint.y);
      const reached = distance <= 10;

      if (reached && now >= activeRoute.nextMoveAt) {
        activeRoute.waypoint = chooseAmbientWaypoint(activeRoute.waypoint);
        activeRoute.nextMoveAt = now + randomInt(3000, 9000);
      }

      ambientRoutes.set(agent.id, activeRoute);
      waypointName = activeRoute.waypoint;
    } else {
      ambientRoutes.delete(agent.id);
    }

    targetWaypointByAgent.set(agent.id, waypointName);
    if (waypointName) {
      const waypoint = getWaypoint(waypointName);
      targetX = waypoint.x;
      targetY = waypoint.y;
    }

    return {
      id: agent.id,
      x: agent.simPosition?.x ?? 100,
      y: agent.simPosition?.y ?? 100,
      targetX,
      targetY,
      speed: 90,
      state: agent.state as AgentState
    };
  });

  const stepped = tickAgents(simInput, simTickMs);

  for (const steppedAgent of stepped) {
    const taskStatus = taskByAssignee.get(steppedAgent.id);
    const waypointName = targetWaypointByAgent.get(steppedAgent.id);

    const mappedState: AgentState =
      taskStatus === "IN_PROGRESS"
        ? "WORKING"
        : taskStatus === "PENDING_APPROVAL"
          ? "MEETING"
          : taskStatus === "BLOCKED"
            ? "BLOCKED"
            : steppedAgent.state === "MOVING"
              ? "MOVING"
              : ambientPatrolEnabled && waypointName
                ? idleStateForWaypoint(waypointName)
                : "IDLE";

    const existingAgent = await prisma.agent.findUnique({
      where: {
        id: steppedAgent.id
      },
      select: {
        workspaceId: true
      }
    });

    if (!existingAgent) {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.simPosition.upsert({
        where: { agentId: steppedAgent.id },
        create: {
          workspaceId: existingAgent.workspaceId,
          agentId: steppedAgent.id,
          x: steppedAgent.x,
          y: steppedAgent.y,
          state: mappedState
        },
        update: {
          workspaceId: existingAgent.workspaceId,
          x: steppedAgent.x,
          y: steppedAgent.y,
          state: mappedState
        }
      });

      await tx.agent.update({
        where: { id: steppedAgent.id },
        data: {
          state: mappedState
        }
      });
    });

    await publish("sim.agent.position.updated", {
      workspaceId: existingAgent.workspaceId,
      agentId: steppedAgent.id,
      x: Number(steppedAgent.x.toFixed(2)),
      y: Number(steppedAgent.y.toFixed(2))
    });

    await publish("sim.agent.state.updated", {
      workspaceId: existingAgent.workspaceId,
      agentId: steppedAgent.id,
      state: mappedState
    });
  }
}

async function main() {
  wss.on("connection", (socket, request) => {
    const token = parsePresentationToken(request.url);
    const context = verifyPresentationToken(token, getSessionSecret());

    if (!context) {
      socket.close(4001, "Unauthorized");
      return;
    }

    socketContexts.set(socket, context);

    socket.send(
      JSON.stringify({
        type: "presentation.session.ready",
        payload: {
          workspaceId: context.workspaceId,
          channel: context.channel
        },
        emittedAt: new Date().toISOString()
      })
    );
  });

  await redisSub.subscribe(REALTIME_CHANNEL);
  redisSub.on("message", (_channel, message) => {
    void (async () => {
      try {
        const event = JSON.parse(message) as RealtimeEvent;
        const workspaceId = await resolveWorkspaceIdForRealtimeEvent(prisma, event);

        if (!workspaceId) {
          return;
        }

        broadcastScopedEvent(event, workspaceId);

        const patch = await buildPresentationPatchForEvent(prisma, workspaceId, event);
        if (patch) {
          broadcastPresentationPatch(workspaceId, patch);
        }
      } catch {
        // Ignore malformed realtime payloads.
      }
    })();
  });

  const worker = new Worker(
    TASK_EXECUTION_QUEUE,
    async (job) => {
      const taskId = String(job.data.taskId);
      await processTask(taskId);
    },
    {
      connection: new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false }),
      concurrency: 4
    }
  );

  worker.on("failed", (job, err) => {
    console.error("Task job failed", { jobId: job?.id, error: err.message });
  });

  setInterval(() => {
    void simulationTick().catch((error) => {
      console.error("Simulation tick error", error);
    });
  }, simTickMs);

  setInterval(() => {
    void scheduleTick().catch((error) => {
      console.error("Schedule tick error", error);
    });
  }, scheduleTickMs);

  console.log(`Second Space worker running. WebSocket gateway on ws://localhost:${wsPort}`);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
