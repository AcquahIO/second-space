import { NextRequest, NextResponse } from "next/server";
import { createKnowledgeSourceWithChunks } from "@/lib/knowledge/store";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const title = String(body.title ?? "Workspace note").trim();
    const content = String(body.content ?? "").trim();

    if (!content) {
      return jsonError("content is required", 400);
    }

    const source = await createKnowledgeSourceWithChunks({
      workspaceId: session.workspaceId,
      type: "NOTE",
      title,
      rawContent: content,
      metadata: {
        importedAt: new Date().toISOString()
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "KNOWLEDGE_NOTE_ADDED",
        target: source.id,
        metadata: {
          title
        }
      }
    });

    return NextResponse.json({ source });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create note", 500);
  }
}
