import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const memoryId = context.params.id;
    const existing = await prisma.agentMemory.findFirst({
      where: {
        id: memoryId,
        workspaceId: session.workspaceId
      },
      include: {
        agent: {
          select: {
            name: true
          }
        }
      }
    });

    if (!existing) {
      return jsonError("Memory not found", 404);
    }

    await prisma.agentMemory.delete({
      where: { id: memoryId }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        action: "AGENT_MEMORY_DELETED",
        target: memoryId,
        metadata: {
          agentId: existing.agentId
        }
      }
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId: existing.workspaceId,
      id: `${memoryId}:memory-deleted`,
      message: `Memory removed for ${existing.agent.name}`,
      category: "SYSTEM",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete memory", 500);
  }
}
