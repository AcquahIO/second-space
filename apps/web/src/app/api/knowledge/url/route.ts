import { NextRequest, NextResponse } from "next/server";
import { createKnowledgeSourceWithChunks } from "@/lib/knowledge/store";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

function htmlToText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const sourceUrl = String(body.url ?? "").trim();
    const customTitle = String(body.title ?? "").trim();

    if (!sourceUrl) {
      return jsonError("url is required", 400);
    }

    let rawContent = String(body.content ?? "").trim();

    if (!rawContent) {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return jsonError("Failed to fetch URL content", 400);
      }

      const html = await response.text();
      rawContent = htmlToText(html);
    }

    if (!rawContent) {
      return jsonError("No readable content extracted", 400);
    }

    const source = await createKnowledgeSourceWithChunks({
      workspaceId: session.workspaceId,
      type: "URL",
      title: customTitle || sourceUrl,
      sourceUrl,
      rawContent,
      metadata: {
        importedAt: new Date().toISOString()
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "KNOWLEDGE_URL_ADDED",
        target: source.id,
        metadata: {
          url: sourceUrl
        }
      }
    });

    return NextResponse.json({ source });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not ingest URL", 500);
  }
}
