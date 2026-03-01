import {
  AGENT_CONTRACTS,
  WORKSPACE_SCENE_INCLUDES,
  type WorkspaceSceneAgent,
  type WorkspaceSceneApprovalSummary,
  type WorkspaceSceneFeedItem,
  type WorkspaceSceneHoldSummary,
  type WorkspaceSceneInclude,
  type WorkspaceSceneIntegrationStatus,
  type WorkspaceSceneResponse,
  type WorkspaceSceneTaskSummary,
  type WorkspaceSceneView
} from "@second-space/shared-types";
import { OFFICE_WAYPOINTS } from "@second-space/sim-engine";
import { prisma } from "@/lib/db/prisma";
import { listFeed } from "@/lib/orchestration/service";
import {
  buildSceneSummary,
  getSceneBadgeLabel,
  mapAgentStateToStatusTone,
  resolveSceneZone
} from "./workspace-scene-helpers";

const TERMINAL_TASK_STATUSES = ["DONE", "FAILED", "CANCELLED"] as const;

export interface BuildWorkspaceSceneOptions {
  view?: WorkspaceSceneView;
  selectedAgentId?: string | null;
  include?: Iterable<WorkspaceSceneInclude>;
}

function buildCameraPreset(view: WorkspaceSceneView): string {
  return view === "overview" ? "workspace-overview-v1" : "workspace-office-v1";
}

function readStringMetadata(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function mapSceneAgent(
  agent: {
    id: string;
    name: string;
    role: "DIRECTOR" | "MANAGER" | "SPECIALIST";
    specialistRole:
      | "PROJECT_MANAGER"
      | "TECH_LEAD"
      | "SOFTWARE_ENGINEER"
      | "QA_TESTER"
      | "DEVOPS_ENGINEER"
      | "SECURITY_AGENT"
      | "CONTENT_AGENT"
      | "MARKETING_AGENT"
      | "FINANCE_AGENT"
      | "CUSTOMER_SUPPORT_AGENT"
      | "OPERATIONS_LOGISTICS_AGENT";
    specialty: string;
    state: "IDLE" | "MOVING" | "WORKING" | "MEETING" | "BLOCKED";
    managerId: string | null;
    manager: { name: string } | null;
    stats: { mood: "FOCUSED" | "NEUTRAL" | "STRESSED" } | null;
    simPosition: { x: number; y: number } | null;
  },
  selectedAgentId: string | null | undefined
): WorkspaceSceneAgent {
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
      selected: agent.id === selectedAgentId
    }
  };
}

function mapTaskSummary(task: {
  id: string;
  title: string;
  status: WorkspaceSceneTaskSummary["status"];
  requiresApproval: boolean;
  externalAction: boolean;
  updatedAt: Date;
  assignee: { id: string; name: string };
}): WorkspaceSceneTaskSummary {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    assigneeId: task.assignee.id,
    assigneeName: task.assignee.name,
    requiresApproval: task.requiresApproval,
    externalAction: task.externalAction,
    updatedAt: task.updatedAt.toISOString()
  };
}

function mapApprovalSummary(approval: {
  id: string;
  createdAt: Date;
  task: {
    id: string;
    title: string;
    status: WorkspaceSceneApprovalSummary["taskStatus"];
    assignee: { id: string; name: string };
  };
}): WorkspaceSceneApprovalSummary {
  return {
    id: approval.id,
    taskId: approval.task.id,
    taskTitle: approval.task.title,
    taskStatus: approval.task.status,
    assigneeId: approval.task.assignee.id,
    assigneeName: approval.task.assignee.name,
    createdAt: approval.createdAt.toISOString()
  };
}

function mapHoldSummary(hold: {
  id: string;
  scope: WorkspaceSceneHoldSummary["scope"];
  severity: WorkspaceSceneHoldSummary["severity"];
  status: WorkspaceSceneHoldSummary["status"];
  reason: string;
  taskId: string | null;
  createdAt: Date;
}): WorkspaceSceneHoldSummary {
  return {
    id: hold.id,
    scope: hold.scope,
    severity: hold.severity,
    status: hold.status,
    reason: hold.reason,
    taskId: hold.taskId,
    createdAt: hold.createdAt.toISOString()
  };
}

function mapFeedItem(item: {
  id: string;
  message: string;
  category: "TASK" | "SYSTEM";
  createdAt: string;
}): WorkspaceSceneFeedItem {
  return {
    id: item.id,
    message: item.message,
    category: item.category,
    createdAt: item.createdAt
  };
}

export async function buildWorkspaceScene(
  workspaceId: string,
  options: BuildWorkspaceSceneOptions = {}
): Promise<WorkspaceSceneResponse> {
  const view = options.view ?? "office";
  const include = new Set(options.include ?? []);
  const selectedAgentId = options.selectedAgentId ?? null;

  const [workspace, agentsRaw, pendingApprovalCount, activeHoldCount, workspaceBlocked] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        slug: true,
        onboardingState: true,
        subscription: {
          select: {
            status: true
          }
        }
      }
    }),
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
    }),
    prisma.securityHold.findFirst({
      where: {
        workspaceId,
        status: "ACTIVE",
        scope: "WORKSPACE"
      },
      select: {
        id: true
      }
    })
  ]);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const agents = agentsRaw.map((agent) => mapSceneAgent(agent, selectedAgentId));

  const response: WorkspaceSceneResponse = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      onboardingState: workspace.onboardingState,
      subscriptionStatus: workspace.subscription?.status ?? null,
      blockedByWorkspaceHold: Boolean(workspaceBlocked)
    },
    scene: {
      view,
      cameraPreset: buildCameraPreset(view),
      generatedAt: new Date().toISOString(),
      waypoints: { ...OFFICE_WAYPOINTS }
    },
    summary: buildSceneSummary(agents, pendingApprovalCount, activeHoldCount),
    agents,
    selectedAgent: null
  };

  if (selectedAgentId) {
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

    if (selectedAgent) {
      const [currentTaskCount, blockedTaskCount, latestTaskEvent] = await Promise.all([
        prisma.task.count({
          where: {
            workspaceId,
            assigneeId: selectedAgentId,
            status: {
              notIn: [...TERMINAL_TASK_STATUSES]
            }
          }
        }),
        prisma.task.count({
          where: {
            workspaceId,
            assigneeId: selectedAgentId,
            status: "BLOCKED"
          }
        }),
        prisma.taskEvent.findFirst({
          where: {
            workspaceId,
            task: {
              OR: [{ assigneeId: selectedAgentId }, { createdById: selectedAgentId }]
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            message: true
          }
        })
      ]);

      const contract = AGENT_CONTRACTS[selectedAgent.specialistRole];

      response.selectedAgent = {
        id: selectedAgent.id,
        name: selectedAgent.name,
        title: contract.title,
        specialty: selectedAgent.specialty,
        summary: contract.mission,
        state: selectedAgent.state,
        mood: selectedAgent.mood,
        zone: selectedAgent.zone,
        managerName: selectedAgent.managerName,
        currentTaskCount,
        blockedTaskCount,
        latestFeedMessage: latestTaskEvent?.message ?? null
      };
    }
  }

  if (include.has("integrations")) {
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

    response.integrations = {
      connectedCount: items.filter((item) => item.connected).length,
      items
    };
  }

  const taskLikeIncludes = [...WORKSPACE_SCENE_INCLUDES].filter((item) => include.has(item));
  if (taskLikeIncludes.length > 0) {
    const loaders: Array<Promise<void>> = [];

    if (include.has("tasks")) {
      loaders.push(
        prisma.task
          .findMany({
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
          })
          .then((tasks) => {
            response.tasks = tasks.map(mapTaskSummary);
          })
      );
    }

    if (include.has("feed")) {
      loaders.push(
        listFeed(workspaceId, 15).then((feed) => {
          response.feed = feed.map(mapFeedItem);
        })
      );
    }

    if (include.has("approvals")) {
      loaders.push(
        prisma.approval
          .findMany({
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
          })
          .then((approvals) => {
            response.approvals = approvals.map(mapApprovalSummary);
          })
      );
    }

    if (include.has("holds")) {
      loaders.push(
        prisma.securityHold
          .findMany({
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
          })
          .then((holds) => {
            response.holds = holds.map(mapHoldSummary);
          })
      );
    }

    await Promise.all(loaders);
  }

  return response;
}
