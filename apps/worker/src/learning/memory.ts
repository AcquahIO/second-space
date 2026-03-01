import type { PrismaClient } from "@prisma/client";
import {
  AGENT_CONTRACTS,
  MEMORY_RETENTION_POLICY,
  type AgentContract,
  type MemoryEventType,
  type SpecialistRole
} from "@second-space/shared-types";
import type { Prisma } from "@prisma/client";

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk-[a-z0-9]{20,})\b/gi,
  /\b(gh[pousr]_[a-z0-9]{20,})\b/gi,
  /\b(xox[baprs]-[a-z0-9-]{10,})\b/gi,
  /\b(api[_-]?key\s*[:=]\s*[a-z0-9._-]{8,})\b/gi,
  /\b(bearer\s+[a-z0-9._-]{10,})\b/gi
];

export function redactSensitiveText(input: string): { content: string; redacted: boolean } {
  let output = input;
  let redacted = false;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(output)) {
      redacted = true;
    }
    output = output.replace(pattern, "[REDACTED_SECRET]");
  }

  return { content: output, redacted };
}

export async function recordMemoryEvent(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    eventType: MemoryEventType;
    content: string;
    agentId?: string | null;
    taskId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const safe = redactSensitiveText(input.content);

  return prisma.memoryEvent.create({
    data: {
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      content: safe.content,
      redacted: safe.redacted,
      agentId: input.agentId ?? null,
      taskId: input.taskId ?? null,
      metadata: input.metadata as Prisma.InputJsonValue | undefined
    }
  });
}

export async function purgeExpiredMemoryEvents(prisma: PrismaClient, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MEMORY_RETENTION_POLICY.rawEventRetentionDays);

  return prisma.memoryEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoff
      }
    }
  });
}

export async function buildUserContextSummary(prisma: PrismaClient, workspaceId: string) {
  const contexts = await prisma.userContext.findMany({
    where: {
      workspaceId
    },
    orderBy: [{ weight: "desc" }, { updatedAt: "desc" }],
    take: 8
  });

  if (!contexts.length) {
    return "";
  }

  return contexts.map((context) => `- [${context.type}] ${context.title}: ${context.content}`).join("\n");
}

export async function buildLongTermMemorySummary(prisma: PrismaClient, workspaceId: string, agentId: string) {
  const memories = await prisma.agentMemory.findMany({
    where: {
      workspaceId,
      agentId
    },
    orderBy: {
      updatedAt: "desc"
    },
    take: 8
  });

  if (!memories.length) {
    return "";
  }

  return memories.map((memory) => `- ${memory.content}`).join("\n");
}

function mergeContractProposal(baseContract: AgentContract, proposedContract: unknown): AgentContract {
  if (!proposedContract || typeof proposedContract !== "object") {
    return baseContract;
  }

  const candidate = proposedContract as Partial<AgentContract>;
  const merged: AgentContract = {
    ...baseContract,
    ...candidate,
    specialistRole: baseContract.specialistRole,
    decisionRights: {
      autonomous:
        Array.isArray(candidate.decisionRights?.autonomous) && candidate.decisionRights.autonomous.length
          ? candidate.decisionRights.autonomous
          : baseContract.decisionRights.autonomous,
      requiresApproval:
        Array.isArray(candidate.decisionRights?.requiresApproval) && candidate.decisionRights.requiresApproval.length
          ? candidate.decisionRights.requiresApproval
          : baseContract.decisionRights.requiresApproval,
      prohibited:
        Array.isArray(candidate.decisionRights?.prohibited) && candidate.decisionRights.prohibited.length
          ? candidate.decisionRights.prohibited
          : baseContract.decisionRights.prohibited
    },
    permissions: {
      read:
        Array.isArray(candidate.permissions?.read) && candidate.permissions.read.length
          ? candidate.permissions.read
          : baseContract.permissions.read,
      writeInternal:
        Array.isArray(candidate.permissions?.writeInternal) && candidate.permissions.writeInternal.length
          ? candidate.permissions.writeInternal
          : baseContract.permissions.writeInternal,
      writeExternal:
        Array.isArray(candidate.permissions?.writeExternal) && candidate.permissions.writeExternal.length
          ? candidate.permissions.writeExternal
          : baseContract.permissions.writeExternal
    }
  };

  if (!Array.isArray(merged.modes) || !merged.modes.length) {
    merged.modes = baseContract.modes;
  }
  if (!Array.isArray(merged.playbooks) || !merged.playbooks.length) {
    merged.playbooks = baseContract.playbooks;
  }
  if (!Array.isArray(merged.toolsNeeded) || !merged.toolsNeeded.length) {
    merged.toolsNeeded = baseContract.toolsNeeded;
  }
  if (!Array.isArray(merged.memoryRules) || !merged.memoryRules.length) {
    merged.memoryRules = baseContract.memoryRules;
  }
  if (!Array.isArray(merged.accountability) || !merged.accountability.length) {
    merged.accountability = baseContract.accountability;
  }
  if (!merged.title?.trim()) {
    merged.title = baseContract.title;
  }
  if (!merged.mission?.trim()) {
    merged.mission = baseContract.mission;
  }
  if (!merged.soul?.trim()) {
    merged.soul = baseContract.soul;
  }
  if (!merged.identity?.trim()) {
    merged.identity = baseContract.identity;
  }
  if (!merged.reportsTo?.trim()) {
    merged.reportsTo = baseContract.reportsTo;
  }

  return merged;
}

export async function buildContractPrompt(
  prisma: PrismaClient,
  input: {
    workspaceId: string;
    agentId: string;
    specialistRole: SpecialistRole;
  }
): Promise<string> {
  const baseContract = AGENT_CONTRACTS[input.specialistRole];

  const [latestApproved, approvedCount] = await Promise.all([
    prisma.contractProposal.findFirst({
      where: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        status: "APPROVED"
      },
      select: {
        proposedContract: true
      },
      orderBy: [{ resolvedAt: "desc" }, { createdAt: "desc" }]
    }),
    prisma.contractProposal.count({
      where: {
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        status: "APPROVED"
      }
    })
  ]);

  const contract = latestApproved
    ? mergeContractProposal(baseContract, latestApproved.proposedContract)
    : baseContract;
  const contractVersion = 1 + approvedCount;

  const modeText = contract.modes.map((mode) => `${mode.mode}: ${mode.description}`).join("; ");
  const prohibited = contract.decisionRights.prohibited.join("; ");
  const requiresApproval = contract.decisionRights.requiresApproval.join("; ");

  return [
    `Contract Version: v${contractVersion}`,
    `Role: ${contract.title}`,
    `Mission: ${contract.mission}`,
    `Soul: ${contract.soul}`,
    `Identity: ${contract.identity}`,
    `Operating Principle: ${contract.operatingPrinciple ?? "Operate with rigor and safety."}`,
    `Modes: ${modeText}`,
    `Requires approval for: ${requiresApproval}`,
    `Prohibited: ${prohibited}`,
    "Never output or retain plaintext secrets."
  ].join("\n");
}
