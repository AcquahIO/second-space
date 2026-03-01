import type { AgentRole, ApprovalType, CommandMode, SpecialistRole, TaskStatus } from "@second-space/shared-types";
import { assertTaskTransition } from "@second-space/shared-types";
import { prisma } from "@/lib/db/prisma";
import { parseCommandText } from "@/lib/commands/parser";
import { getTaskQueue } from "@/lib/orchestration/queue";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";

function chooseApprovalType(externalAction: boolean): ApprovalType {
  return externalAction ? "EXTERNAL_ACTION" : "HIGH_RISK_ACTION";
}

function rolePriority(role: AgentRole): number {
  switch (role) {
    case "DIRECTOR":
      return 0;
    case "MANAGER":
      return 1;
    case "SPECIALIST":
      return 2;
    default:
      return 99;
  }
}

function detectWriteAction(text: string): boolean {
  return /(send|email|post|publish|commit|push|deploy|notify|message)/i.test(text);
}

export async function createCommandDraft(workspaceId: string, rawText: string, mode?: CommandMode) {
  const parsed = parseCommandText(rawText, mode);

  const draft = await prisma.commandDraft.create({
    data: {
      workspaceId,
      rawText,
      intent: parsed.intent,
      mode: parsed.mode,
      proposedTasks: parsed.proposedTasks as unknown as object
    }
  });

  return {
    id: draft.id,
    workspaceId: draft.workspaceId,
    rawText: draft.rawText,
    intent: draft.intent,
    mode: draft.mode,
    proposedTasks: parsed.proposedTasks,
    clarifyingQuestions: parsed.clarifyingQuestions,
    createdAt: draft.createdAt.toISOString()
  };
}

export async function confirmCommandDraft(workspaceId: string, commandId: string) {
  const draft = await prisma.commandDraft.findFirst({ where: { id: commandId, workspaceId } });

  if (!draft) {
    throw new Error("Command draft not found");
  }

  const proposedTasks = draft.proposedTasks as Array<{
    title: string;
    description: string;
    assigneeRole?: AgentRole;
    assigneeSpecialistRole?: SpecialistRole;
    requiresApproval: boolean;
    externalAction: boolean;
    toolName?: string;
    parentIndex?: number;
    metadata?: Record<string, unknown>;
  }>;

  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });

  const agentsByRole = agents.reduce<Record<AgentRole, typeof agents>>(
    (acc, agent) => {
      const key = agent.role as AgentRole;
      acc[key] = [...(acc[key] ?? []), agent];
      return acc;
    },
    {
      DIRECTOR: [],
      MANAGER: [],
      SPECIALIST: []
    }
  );

  const agentsBySpecialistRole = agents.reduce<Record<string, typeof agents>>((acc, agent) => {
    acc[agent.specialistRole] = [...(acc[agent.specialistRole] ?? []), agent];
    return acc;
  }, {});

  const roleCounters: Record<AgentRole, number> = {
    DIRECTOR: 0,
    MANAGER: 0,
    SPECIALIST: 0
  };

  const specialistCounters = new Map<string, number>();

  const created = await prisma.$transaction(async (tx) => {
    const createdTasks: {
      id: string;
      index: number;
      assigneeId: string;
      status: TaskStatus;
      title: string;
      approvalId?: string;
    }[] = [];

    for (let index = 0; index < proposedTasks.length; index += 1) {
      const taskDef = proposedTasks[index];

      let candidateAgents: typeof agents = [];
      if (taskDef.assigneeSpecialistRole) {
        candidateAgents = agentsBySpecialistRole[taskDef.assigneeSpecialistRole] ?? [];
      }

      if (!candidateAgents.length && taskDef.assigneeRole) {
        candidateAgents = agentsByRole[taskDef.assigneeRole] ?? [];
      }

      if (!candidateAgents.length) {
        candidateAgents = agentsByRole.SPECIALIST;
      }

      if (!candidateAgents.length) {
        throw new Error("No agents available in workspace");
      }

      let assignee = candidateAgents[0];
      if (taskDef.assigneeSpecialistRole) {
        const specialistCounter = specialistCounters.get(taskDef.assigneeSpecialistRole) ?? 0;
        assignee = candidateAgents[specialistCounter % candidateAgents.length];
        specialistCounters.set(taskDef.assigneeSpecialistRole, specialistCounter + 1);
      } else if (taskDef.assigneeRole) {
        const roleCounter = roleCounters[taskDef.assigneeRole] % candidateAgents.length;
        assignee = candidateAgents[roleCounter];
        roleCounters[taskDef.assigneeRole] += 1;
      }

      const parentTask = typeof taskDef.parentIndex === "number" ? createdTasks.find((t) => t.index === taskDef.parentIndex) : null;

      const writeInferred = draft.mode === "execute" ? detectWriteAction(`${taskDef.title} ${taskDef.description}`) : false;
      const requiresApproval = draft.mode === "execute" ? taskDef.requiresApproval || writeInferred : false;
      const initialStatus: TaskStatus = requiresApproval ? "PENDING_APPROVAL" : "ASSIGNED";
      const creatorId =
        agentsBySpecialistRole.PROJECT_MANAGER?.[0]?.id ?? agentsByRole.DIRECTOR[0]?.id ?? assignee.id;

      const task = await tx.task.create({
        data: {
          workspaceId,
          title: taskDef.title,
          description: taskDef.description,
          status: initialStatus,
          assigneeId: assignee.id,
          createdById: creatorId,
          parentTaskId: parentTask?.id ?? null,
          requiresApproval,
          externalAction: draft.mode === "execute" ? taskDef.externalAction || writeInferred : false,
          toolName: taskDef.toolName ?? "OpenAI Core",
          metadata: {
            sourceCommandId: draft.id,
            intent: draft.intent,
            commandMode: draft.mode,
            rolePriority: rolePriority(assignee.role as AgentRole),
            specialistRole: assignee.specialistRole,
            ...taskDef.metadata
          }
        }
      });

      await tx.taskEvent.create({
        data: {
          workspaceId,
          taskId: task.id,
          type: "TASK_CREATED",
          message: `Task created for ${assignee.name}`,
          metadata: {
            source: "command-confirm",
            status: initialStatus
          }
        }
      });

      await tx.memoryEvent.create({
        data: {
          workspaceId,
          taskId: task.id,
          agentId: task.assigneeId,
          eventType: "TASK_CREATED",
          content: `Task created: ${task.title} assigned to ${assignee.name}`
        }
      });

      await tx.conversation.create({
        data: {
          workspaceId,
          taskId: task.id
        }
      });

      if (requiresApproval) {
        const approval = await tx.approval.create({
          data: {
            workspaceId,
            taskId: task.id,
            type: chooseApprovalType(taskDef.externalAction || writeInferred),
            reason: "External side effect requires explicit human approval"
          }
        });

        await tx.taskEvent.create({
          data: {
            workspaceId,
            taskId: task.id,
            type: "APPROVAL_REQUESTED",
            message: "Task is pending approval",
            metadata: {
              approvalId: approval.id
            }
          }
        });

        await tx.memoryEvent.create({
          data: {
            workspaceId,
            taskId: task.id,
            agentId: task.assigneeId,
            eventType: "APPROVAL_REQUESTED",
            content: `Approval requested for ${task.title}`
          }
        });

        createdTasks.push({
          id: task.id,
          index,
          assigneeId: task.assigneeId,
          status: task.status as TaskStatus,
          title: task.title,
          approvalId: approval.id
        });
        continue;
      }

      createdTasks.push({
        id: task.id,
        index,
        assigneeId: task.assigneeId,
        status: task.status as TaskStatus,
        title: task.title
      });
    }

    await tx.auditLog.create({
      data: {
        workspaceId,
        action: "COMMAND_CONFIRMED",
        target: draft.id,
        metadata: {
          taskCount: createdTasks.length,
          mode: draft.mode
        }
      }
    });

    return createdTasks;
  });

  for (const task of created) {
    await publishRealtimeEvent("task.created", {
      workspaceId,
      taskId: task.id,
      status: task.status,
      assigneeId: task.assigneeId,
      title: task.title
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId,
      id: `${task.id}:created`,
      message: `Task created: ${task.title}`,
      category: "TASK",
      createdAt: new Date().toISOString()
    });

    if (task.status !== "PENDING_APPROVAL") {
      await getTaskQueue().add("execute-task", { taskId: task.id });
    } else {
      await publishRealtimeEvent("approval.requested", {
        workspaceId,
        approvalId: task.approvalId ?? `task:${task.id}`,
        taskId: task.id,
        status: "PENDING"
      });
    }
  }

  await publishApprovalQueueUpdate(workspaceId);

  return created;
}

export async function handoffTask(workspaceId: string, taskId: string, toAgentId: string, reason: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });

  if (!task) {
    throw new Error("Task not found");
  }

  if (task.status !== "DONE" && task.status !== "FAILED" && task.status !== "CANCELLED") {
    if (task.status !== "ASSIGNED") {
      assertTaskTransition(task.status as TaskStatus, "ASSIGNED");
    }
  } else {
    throw new Error("Cannot handoff terminal task");
  }

  const destinationAgent = await prisma.agent.findFirst({
    where: {
      id: toAgentId,
      workspaceId
    },
    select: {
      id: true
    }
  });

  if (!destinationAgent) {
    throw new Error("Target agent not found in workspace");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.task.update({
      where: { id: taskId },
      data: {
        assigneeId: toAgentId,
        status: "ASSIGNED"
      }
    });

    await tx.taskEvent.create({
      data: {
        workspaceId,
        taskId,
        type: "TASK_HANDOFF",
        message: reason,
        metadata: {
          fromAgentId: task.assigneeId,
          toAgentId
        }
      }
    });

    await tx.memoryEvent.create({
      data: {
        workspaceId,
        taskId,
        agentId: toAgentId,
        eventType: "TASK_HANDOFF",
        content: `Task handoff from ${task.assigneeId} to ${toAgentId}: ${reason}`
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        action: "TASK_HANDOFF",
        target: taskId,
        metadata: {
          fromAgentId: task.assigneeId,
          toAgentId,
          reason
        }
      }
    });

    return next;
  });

  await publishRealtimeEvent("task.handoff.requested", {
    workspaceId,
    taskId,
    fromAgentId: task.assigneeId,
    toAgentId,
    reason
  });

  await publishRealtimeEvent("feed.event", {
    workspaceId,
    id: `${taskId}:handoff:${Date.now()}`,
    message: `Task handoff requested: ${reason}`,
    category: "TASK",
    createdAt: new Date().toISOString()
  });

  await publishRealtimeEvent("task.updated", {
    workspaceId,
    taskId,
    status: updated.status,
    assigneeId: updated.assigneeId,
    title: updated.title
  });

  await getTaskQueue().add("execute-task", { taskId });

  return updated;
}

export async function approveTask(workspaceId: string, taskId: string, userId: string) {
  const approval = await prisma.approval.findFirst({
    where: {
      workspaceId,
      taskId,
      status: "PENDING"
    }
  });

  if (!approval) {
    throw new Error("No pending approval for task");
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });

  if (!task) {
    throw new Error("Task not found");
  }

  assertTaskTransition(task.status as TaskStatus, "IN_PROGRESS");

  await prisma.$transaction(async (tx) => {
    await tx.approval.update({
      where: { id: approval.id },
      data: {
        status: "APPROVED",
        resolvedById: userId,
        resolvedAt: new Date()
      }
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status: "IN_PROGRESS"
      }
    });

    await tx.taskEvent.createMany({
      data: [
        {
          workspaceId,
          taskId,
          type: "APPROVAL_RESOLVED",
          message: "Approval accepted by operator",
          metadata: {
            approvalId: approval.id,
            status: "APPROVED"
          }
        },
        {
          workspaceId,
          taskId,
          type: "TASK_STATUS",
          message: "Task moved to IN_PROGRESS",
          metadata: {
            status: "IN_PROGRESS"
          }
        }
      ]
    });

    await tx.memoryEvent.create({
      data: {
        workspaceId,
        taskId,
        agentId: task.assigneeId,
        eventType: "APPROVAL_RESOLVED",
        content: `Approval approved for task ${task.title}`
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: "APPROVAL_APPROVED",
        target: taskId,
        metadata: {
          approvalId: approval.id
        }
      }
    });
  });

  await publishRealtimeEvent("approval.resolved", {
    workspaceId,
    approvalId: approval.id,
    taskId,
    status: "APPROVED"
  });

  await publishRealtimeEvent("feed.event", {
    workspaceId,
    id: `${approval.id}:approved`,
    message: `Approval accepted for task ${task.title}`,
    category: "APPROVAL",
    createdAt: new Date().toISOString()
  });

  await publishRealtimeEvent("task.updated", {
    workspaceId,
    taskId,
    status: "IN_PROGRESS",
    assigneeId: task.assigneeId,
    title: task.title
  });

  await getTaskQueue().add("execute-task", { taskId });
  await publishApprovalQueueUpdate(workspaceId);
}

export async function rejectTask(workspaceId: string, taskId: string, userId: string, reason: string) {
  const approval = await prisma.approval.findFirst({
    where: {
      workspaceId,
      taskId,
      status: "PENDING"
    }
  });

  if (!approval) {
    throw new Error("No pending approval for task");
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, workspaceId } });

  if (!task) {
    throw new Error("Task not found");
  }

  assertTaskTransition(task.status as TaskStatus, "BLOCKED");

  await prisma.$transaction(async (tx) => {
    await tx.approval.update({
      where: { id: approval.id },
      data: {
        status: "REJECTED",
        resolvedById: userId,
        resolvedAt: new Date(),
        reason: reason || approval.reason
      }
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        status: "BLOCKED"
      }
    });

    await tx.taskEvent.create({
      data: {
        workspaceId,
        taskId,
        type: "APPROVAL_REJECTED",
        message: reason || "Approval rejected",
        metadata: {
          approvalId: approval.id
        }
      }
    });

    await tx.memoryEvent.create({
      data: {
        workspaceId,
        taskId,
        agentId: task.assigneeId,
        eventType: "APPROVAL_RESOLVED",
        content: `Approval rejected for task ${task.title}. Reason: ${reason || "Approval rejected"}`
      }
    });

    await tx.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: "APPROVAL_REJECTED",
        target: taskId,
        metadata: {
          approvalId: approval.id,
          reason
        }
      }
    });
  });

  await publishRealtimeEvent("approval.resolved", {
    workspaceId,
    approvalId: approval.id,
    taskId,
    status: "REJECTED"
  });

  await publishRealtimeEvent("feed.event", {
    workspaceId,
    id: `${approval.id}:rejected`,
    message: `Approval rejected for task ${task.title}`,
    category: "APPROVAL",
    createdAt: new Date().toISOString()
  });

  await publishRealtimeEvent("task.updated", {
    workspaceId,
    taskId,
    status: "BLOCKED",
    assigneeId: task.assigneeId,
    title: task.title
  });

  await publishApprovalQueueUpdate(workspaceId);
}

export async function publishApprovalQueueUpdate(workspaceId: string) {
  const pendingCount = await prisma.approval.count({
    where: {
      workspaceId,
      status: "PENDING"
    }
  });

  await publishRealtimeEvent("approval.queue.updated", {
    workspaceId,
    pendingCount,
    updatedAt: new Date().toISOString()
  });
}

export async function listFeed(workspaceId: string, limit = 60) {
  const [taskEvents, auditLogs] = await Promise.all([
    prisma.taskEvent.findMany({
      where: { workspaceId },
      take: limit,
      orderBy: { createdAt: "desc" }
    }),
    prisma.auditLog.findMany({
      where: { workspaceId },
      take: Math.floor(limit / 3),
      orderBy: { createdAt: "desc" }
    })
  ]);

  const feed = [
    ...taskEvents.map((event) => ({
      id: event.id,
      message: event.message,
      category: "TASK" as const,
      createdAt: event.createdAt.toISOString(),
      metadata: event.metadata
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      message: `${log.action}: ${log.target}`,
      category: "SYSTEM" as const,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata
    }))
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return feed.slice(0, limit);
}
