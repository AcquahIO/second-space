import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";

const createMemorySchema = z.object({
  agentId: z.string().min(1),
  content: z.string().min(4).max(500)
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const agents = await prisma.agent.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      select: {
        id: true,
        name: true,
        role: true,
        memories: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: {
            updatedAt: "desc"
          },
          take: 40
        }
      },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });

    return NextResponse.json({ agents });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch memories", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = createMemorySchema.parse(await request.json());
    const normalizedContent = body.content.trim();
    if (!normalizedContent) {
      return jsonError("Memory content is required");
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id: body.agentId,
        workspaceId: session.workspaceId
      },
      select: { id: true, name: true }
    });

    if (!agent) {
      return jsonError("Agent not found", 404);
    }

    const memory = await prisma.agentMemory.create({
      data: {
        workspaceId: session.workspaceId,
        agentId: body.agentId,
        content: normalizedContent
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        action: "AGENT_MEMORY_CREATED",
        target: memory.id,
        metadata: {
          agentId: agent.id,
          agentName: agent.name
        }
      }
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId: session.workspaceId,
      id: `${memory.id}:memory`,
      message: `Memory saved for ${agent.name}`,
      category: "SYSTEM",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ memory });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid memory payload");
    }

    return jsonError(error instanceof Error ? error.message : "Could not save memory", 500);
  }
}
