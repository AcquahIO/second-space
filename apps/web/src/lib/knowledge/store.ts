import { prisma } from "@/lib/db/prisma";
import { createChunkRecords } from "@/lib/knowledge/ingest";
import type { Prisma } from "@prisma/client";

interface CreateSourceInput {
  workspaceId: string;
  type: "FILE" | "URL" | "NOTE";
  title: string;
  rawContent: string;
  sourceUrl?: string | null;
  filePath?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createKnowledgeSourceWithChunks(input: CreateSourceInput) {
  const chunkRecords = await createChunkRecords(input.rawContent);

  return prisma.$transaction(async (tx) => {
    const source = await tx.knowledgeSource.create({
      data: {
        workspaceId: input.workspaceId,
        type: input.type,
        title: input.title,
        sourceUrl: input.sourceUrl,
        filePath: input.filePath,
        rawContent: input.rawContent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });

    if (chunkRecords.length) {
      await tx.knowledgeChunk.createMany({
        data: chunkRecords.map((chunk) => ({
          workspaceId: input.workspaceId,
          sourceId: source.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          embedding: (chunk.embedding ?? undefined) as Prisma.InputJsonValue | undefined
        }))
      });
    }

    await tx.workspaceOnboardingStep.upsert({
      where: {
        workspaceId_step: {
          workspaceId: input.workspaceId,
          step: "KNOWLEDGE_IMPORT"
        }
      },
      update: {
        completedAt: new Date()
      },
      create: {
        workspaceId: input.workspaceId,
        step: "KNOWLEDGE_IMPORT"
      }
    });

    await tx.workspace.update({
      where: {
        id: input.workspaceId
      },
      data: {
        onboardingState: "KNOWLEDGE_IMPORT"
      }
    });

    return source;
  });
}
