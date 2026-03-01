import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function DELETE(request: NextRequest, context: { params: { sourceId: string } }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const source = await prisma.knowledgeSource.findFirst({
      where: {
        id: context.params.sourceId,
        workspaceId: session.workspaceId
      },
      select: {
        id: true
      }
    });

    if (!source) {
      return jsonError("Knowledge source not found", 404);
    }

    await prisma.knowledgeSource.delete({
      where: {
        id: source.id
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "KNOWLEDGE_SOURCE_DELETED",
        target: source.id
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete source", 500);
  }
}
