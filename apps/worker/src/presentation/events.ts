import type { PrismaClient } from "@prisma/client";
import { OFFICE_WAYPOINTS } from "@second-space/sim-engine";
import type {
  PresentationScenePatch,
  RealtimeEvent,
  WorkspaceSceneAgent,
  WorkspaceSceneApprovalSummary,
  WorkspaceSceneFeedItem,
  WorkspaceSceneHoldSummary,
  WorkspaceSceneIntegrationStatus,
  WorkspaceSceneSummary,
  WorkspaceSceneZone,
  WorkspaceSceneZoneOccupancy
} from "@second-space/shared-types";

const TERMINAL_TASK_STATUSES = ["DONE", "FAILED", "CANCELLED"] as const;
const waypointEntries = Object.entries(OFFICE_WAYPOINTS) as Array<[WorkspaceSceneZone, { x: number; y: number }]>;

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readStringMetadata(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getSceneBadgeLabel(name: string): string {
  const firstToken = name.trim().split(/\s+/)[0];
  return firstToken || "Agent";
}

function mapAgentStateToStatusTone(state: WorkspaceSceneAgent["state"]): WorkspaceSceneAgent["badge"]["statusTone"] {
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

function resolveSceneZone(x: number | null | undefined, y: number | null | undefined): WorkspaceSceneZone {
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

function buildSceneSummary(
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

function buildZoneOccupancy(agents: Array<Pick<WorkspaceSceneAgent, "id" | "zone" | "state">>): WorkspaceSceneZoneOccupancy[] {
  return waypointEntries.map(([zone]) => {
    const zoneAgents = agents.filter((agent) => agent.zone === zone);
    return {
      zone,
      count: zoneAgents.length,
      agentIds: zoneAgents.map((agent) => agent.id),
      blockedCount: zoneAgents.filter((agent) => agent.state === "BLOCKED").length,
      workingCount: zoneAgents.filter((agent) => agent.state === "WORKING").length,
      meetingCount: zoneAgents.filter((agent) => agent.state === "MEETING").length
    };
  });
}

function mapIntegrationStatus(integration: {
  provider: "GITHUB" | "GMAIL" | "LINKEDIN";
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  accountLabel: string | null;
  tokenMetadata: unknown;
}): WorkspaceSceneIntegrationStatus {
  const repoOwner = readStringMetadata(integration.tokenMetadata, "repoOwner");
  const repoName = readStringMetadata(integration.tokenMetadata, "repoName");
  const defaultBranch = readStringMetadata(integration.tokenMetadata, "defaultBranch");

  return {
    provider: integration.provider,
    authStatus: integration.authStatus,
    connected: integration.authStatus === "CONNECTED",
    accountLabel: integration.accountLabel,
    repoFullName: repoOwner && repoName ? `${repoOwner}/${repoName}` : null,
    defaultBranch
  };
}

async function buildAgentSlices(prisma: PrismaClient, workspaceId: string): Promise<Required<Pick<PresentationScenePatch, "agents" | "summary" | "scene">>> {
  const [agentsRaw, pendingApprovalCount, activeHoldCount] = await Promise.all([
    prisma.agent.findMany({
      where: { workspaceId },
      include: {
        stats: {
          select: {
            mood: true
          }
        },
        simPosition: {
          select: {
            x: true,
            y: true
          }
        },
        manager: {
          select: {
            name: true
          }
        }
      },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    }),
    prisma.approval.count({
      where: {
        workspaceId,
        status: "PENDING"
      }
    }),
    prisma.securityHold.count({
      where: {
        workspaceId,
        status: "ACTIVE"
      }
    })
  ]);

  const agents: WorkspaceSceneAgent[] = agentsRaw.map((agent) => {
    const zone = resolveSceneZone(agent.simPosition?.x ?? null, agent.simPosition?.y ?? null);

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      specialistRole: agent.specialistRole,
      specialty: agent.specialty,
      state: agent.state,
      mood: agent.stats?.mood ?? "NEUTRAL",
      managerId: agent.managerId,
      managerName: agent.manager?.name ?? null,
      simPosition: agent.simPosition ? { x: agent.simPosition.x, y: agent.simPosition.y } : null,
      zone,
      badge: {
        label: getSceneBadgeLabel(agent.name),
        statusTone: mapAgentStateToStatusTone(agent.state),
        selected: false
      }
    };
  });

  return {
    agents,
    summary: buildSceneSummary(agents, pendingApprovalCount, activeHoldCount),
    scene: {
      generatedAt: new Date().toISOString(),
      zoneOccupancy: buildZoneOccupancy(agents)
    }
  };
}

async function buildIntegrationsSlice(prisma: PrismaClient, workspaceId: string) {
  const integrations = await prisma.workspaceIntegration.findMany({
    where: { workspaceId },
    select: {
      provider: true,
      authStatus: true,
      accountLabel: true,
      tokenMetadata: true
    },
    orderBy: {
      provider: "asc"
    }
  });

  const items = integrations.map((integration) =>
    mapIntegrationStatus({
      provider: integration.provider,
      authStatus: integration.authStatus,
      accountLabel: integration.accountLabel,
      tokenMetadata: integration.tokenMetadata
    })
  );

  return {
    connectedCount: items.filter((item) => item.connected).length,
    items
  };
}

async function buildFeedSlice(prisma: PrismaClient, workspaceId: string, limit = 15): Promise<WorkspaceSceneFeedItem[]> {
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

  return [
    ...taskEvents.map((event) => ({
      id: event.id,
      message: event.message,
      category: "TASK" as const,
      createdAt: event.createdAt.toISOString()
    })),
    ...auditLogs.map((log) => ({
      id: log.id,
      message: `${log.action}: ${log.target}`,
      category: "SYSTEM" as const,
      createdAt: log.createdAt.toISOString()
    }))
  ]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, limit);
}

async function buildApprovalsSlice(prisma: PrismaClient, workspaceId: string): Promise<WorkspaceSceneApprovalSummary[]> {
  const approvals = await prisma.approval.findMany({
    where: {
      workspaceId,
      status: "PENDING"
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          status: true,
          assignee: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  return approvals.map((approval) => ({
    id: approval.id,
    taskId: approval.task.id,
    taskTitle: approval.task.title,
    taskStatus: approval.task.status,
    assigneeId: approval.task.assignee.id,
    assigneeName: approval.task.assignee.name,
    createdAt: approval.createdAt.toISOString()
  }));
}

async function buildHoldsSlice(prisma: PrismaClient, workspaceId: string): Promise<WorkspaceSceneHoldSummary[]> {
  const holds = await prisma.securityHold.findMany({
    where: {
      workspaceId,
      status: "ACTIVE"
    },
    select: {
      id: true,
      scope: true,
      severity: true,
      status: true,
      reason: true,
      taskId: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });

  return holds.map((hold) => ({
    id: hold.id,
    scope: hold.scope,
    severity: hold.severity,
    status: hold.status,
    reason: hold.reason,
    taskId: hold.taskId,
    createdAt: hold.createdAt.toISOString()
  }));
}

async function buildTasksSlice(prisma: PrismaClient, workspaceId: string) {
  const tasks = await prisma.task.findMany({
    where: { workspaceId },
    include: {
      assignee: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 20
  });

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    assigneeId: task.assignee.id,
    assigneeName: task.assignee.name,
    requiresApproval: task.requiresApproval,
    externalAction: task.externalAction,
    updatedAt: task.updatedAt.toISOString()
  }));
}

export async function resolveWorkspaceIdForRealtimeEvent(
  prisma: PrismaClient,
  event: RealtimeEvent
): Promise<string | null> {
  const payload = event.payload as Record<string, unknown>;

  if (typeof payload.workspaceId === "string" && payload.workspaceId.trim()) {
    return payload.workspaceId;
  }

  if (typeof payload.agentId === "string" && payload.agentId.trim()) {
    const agent = await prisma.agent.findUnique({
      where: { id: payload.agentId },
      select: { workspaceId: true }
    });

    return agent?.workspaceId ?? null;
  }

  if (typeof payload.taskId === "string" && payload.taskId.trim()) {
    const task = await prisma.task.findUnique({
      where: { id: payload.taskId },
      select: { workspaceId: true }
    });

    return task?.workspaceId ?? null;
  }

  if (typeof payload.approvalId === "string" && payload.approvalId.trim()) {
    const approval = await prisma.approval.findUnique({
      where: { id: payload.approvalId },
      select: { workspaceId: true }
    });

    return approval?.workspaceId ?? null;
  }

  return null;
}

export async function buildPresentationPatchForEvent(
  prisma: PrismaClient,
  workspaceId: string,
  event: RealtimeEvent
): Promise<PresentationScenePatch | null> {
  switch (event.type) {
    case "sim.agent.position.updated":
    case "sim.agent.state.updated":
    case "task.created":
    case "task.updated":
    case "task.handoff.requested":
    case "onboarding.step.completed": {
      return buildAgentSlices(prisma, workspaceId);
    }
    case "approval.requested":
    case "approval.resolved":
    case "approval.queue.updated": {
      const [agentSlices, approvals] = await Promise.all([
        buildAgentSlices(prisma, workspaceId),
        buildApprovalsSlice(prisma, workspaceId)
      ]);
      return {
        ...agentSlices,
        approvals
      };
    }
    case "security.hold.placed":
    case "security.hold.released": {
      const [agentSlices, holds] = await Promise.all([
        buildAgentSlices(prisma, workspaceId),
        buildHoldsSlice(prisma, workspaceId)
      ]);
      return {
        ...agentSlices,
        holds
      };
    }
    case "integration.connected":
    case "integration.connection_failed": {
      return {
        integrations: await buildIntegrationsSlice(prisma, workspaceId)
      };
    }
    case "feed.event":
    case "learning.proposal.created":
    case "learning.proposal.resolved": {
      return {
        feed: await buildFeedSlice(prisma, workspaceId)
      };
    }
    case "schedule.triggered": {
      const [agentSlices, feed, tasks] = await Promise.all([
        buildAgentSlices(prisma, workspaceId),
        buildFeedSlice(prisma, workspaceId),
        buildTasksSlice(prisma, workspaceId)
      ]);
      return {
        ...agentSlices,
        feed,
        tasks
      };
    }
    case "presentation.scene.patch":
      return null;
    default:
      return null;
  }
}
