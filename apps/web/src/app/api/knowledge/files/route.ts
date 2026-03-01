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

    let title = "Uploaded file";
    let content = "";

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!(file instanceof File)) {
        return jsonError("file is required", 400);
      }

      title = file.name || title;
      content = await file.text();
    } else {
      const body = await request.json();
      title = String(body.title ?? title).trim();
      content = String(body.content ?? "");
    }

    if (!content.trim()) {
      return jsonError("File content is required", 400);
    }

    const source = await createKnowledgeSourceWithChunks({
      workspaceId: session.workspaceId,
      type: "FILE",
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
        action: "KNOWLEDGE_FILE_ADDED",
        target: source.id,
        metadata: {
          title
        }
      }
    });

    return NextResponse.json({ source });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not ingest file", 500);
  }
}
