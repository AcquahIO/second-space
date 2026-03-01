import type { PrismaClient } from "@prisma/client";
import { AGENT_CONTRACTS, MEMORY_RETENTION_POLICY } from "@second-space/shared-types";
import type { RealtimeEventName } from "@second-space/shared-types";

function summarizeMemoryEvents(events: Array<{ eventType: string; content: string }>): string {
  if (!events.length) {
    return "No memory events available for this reflection window.";
  }

  const byType = new Map<string, number>();
  for (const event of events) {
    byType.set(event.eventType, (byType.get(event.eventType) ?? 0) + 1);
  }

  const typeSummary = Array.from(byType.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([eventType, count]) => `${eventType}:${count}`)
    .join(", ");

  const exampleSignals = events
    .slice(0, 3)
    .map((event) => event.content.slice(0, 120))
    .join(" | ");

  return `Patterns=${typeSummary}. Signals=${exampleSignals}`;
}

export async function runReflectionCycle(
  prisma: PrismaClient,
  publish: (type: RealtimeEventName, payload: Record<string, unknown>) => Promise<void>
) {
  const workspaces = await prisma.workspace.findMany({
    select: {
      id: true,
      createdAt: true
    }
  });

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  for (const workspace of workspaces) {
    const ageDays = Math.floor((now.getTime() - workspace.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    if (ageDays < MEMORY_RETENTION_POLICY.minWorkspaceAgeDaysForReflection) {
      continue;
    }

    const eventCount = await prisma.memoryEvent.count({
      where: {
        workspaceId: workspace.id,
        createdAt: {
          gte: windowStart
        }
      }
    });

    if (eventCount < MEMORY_RETENTION_POLICY.minEventsForReflection) {
      continue;
    }

    const targetAgents = await prisma.agent.findMany({
      where: {
        workspaceId: workspace.id,
        specialistRole: {
          in: ["PROJECT_MANAGER", "SECURITY_AGENT"]
        }
      },
      select: {
        id: true,
        specialistRole: true
      }
    });

    for (const agent of targetAgents) {
      const recentRun = await prisma.learningReflectionRun.findFirst({
        where: {
          workspaceId: workspace.id,
          agentId: agent.id,
          createdAt: {
            gte: oneDayAgo
          }
        },
        select: {
          id: true
        }
      });

      if (recentRun) {
        continue;
      }

      const events = await prisma.memoryEvent.findMany({
        where: {
          workspaceId: workspace.id,
          OR: [{ agentId: agent.id }, { agentId: null }],
          createdAt: {
            gte: windowStart
          }
        },
        select: {
          eventType: true,
          content: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 120
      });

      const summary = summarizeMemoryEvents(events);

      const run = await prisma.learningReflectionRun.create({
        data: {
          workspaceId: workspace.id,
          agentId: agent.id,
          status: "COMPLETED",
          summary,
          analyzedEventCount: events.length,
          metadata: {
            windowDays: 14,
            mode: "PROPOSE_ONLY"
          }
        }
      });

      const existingPending = await prisma.contractProposal.findFirst({
        where: {
          workspaceId: workspace.id,
          agentId: agent.id,
          status: "PENDING"
        },
        select: {
          id: true
        }
      });

      if (existingPending) {
        continue;
      }

      const role = agent.specialistRole as keyof typeof AGENT_CONTRACTS;
      const currentContract = AGENT_CONTRACTS[role];
      const proposedContract = {
        ...currentContract,
        operatingPrinciple:
          role === "PROJECT_MANAGER"
            ? "Use memory-backed delivery patterns first; propose refinements, never auto-apply."
            : currentContract.operatingPrinciple ?? "Use memory-backed risk reduction and operational discipline."
      };

      const proposal = await prisma.contractProposal.create({
        data: {
          workspaceId: workspace.id,
          agentId: agent.id,
          status: "PENDING",
          title: `${currentContract.title}: organic contract refinement`,
          rationale: summary,
          currentContract: currentContract as unknown as object,
          proposedContract: proposedContract as unknown as object,
          proposedByRunId: run.id
        }
      });

      await publish("learning.proposal.created", {
        proposalId: proposal.id,
        workspaceId: workspace.id,
        status: proposal.status,
        title: proposal.title,
        createdAt: proposal.createdAt.toISOString()
      });
    }
  }
}
