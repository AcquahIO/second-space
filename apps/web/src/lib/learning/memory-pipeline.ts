import { prisma } from "@/lib/db/prisma";
import { MEMORY_RETENTION_POLICY, type MemoryEventType } from "@second-space/shared-types";
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

  return {
    content: output,
    redacted
  };
}

export async function recordMemoryEvent(input: {
  workspaceId: string;
  eventType: MemoryEventType;
  content: string;
  agentId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
}) {
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

export async function purgeExpiredMemoryEvents(now = new Date()) {
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

export async function summarizeRecentMemoryForAgent(workspaceId: string, agentId: string) {
  const events = await prisma.memoryEvent.findMany({
    where: {
      workspaceId,
      agentId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  if (!events.length) {
    return "";
  }

  const grouped = new Map<MemoryEventType, number>();
  for (const event of events) {
    grouped.set(event.eventType as MemoryEventType, (grouped.get(event.eventType as MemoryEventType) ?? 0) + 1);
  }

  const summary = Array.from(grouped.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([eventType, count]) => `${eventType}: ${count}`)
    .join("; ");

  return `Recent memory patterns (${events.length} events): ${summary}`;
}
