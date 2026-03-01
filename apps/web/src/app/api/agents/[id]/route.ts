import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const existing = await prisma.agent.findFirst({
      where: {
        id: params.id,
        workspaceId: session.workspaceId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return jsonError("Agent not found", 404);
    }

    const body = await request.json();
    const updateData: {
      name?: string;
      specialty?: string;
      state?: "IDLE" | "MOVING" | "WORKING" | "MEETING" | "BLOCKED";
    } = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }

    if (typeof body.specialty === "string" && body.specialty.trim()) {
      updateData.specialty = body.specialty.trim();
    }

    if (["IDLE", "MOVING", "WORKING", "MEETING", "BLOCKED"].includes(body.state)) {
      updateData.state = body.state;
    }

    const agent = await prisma.agent.update({
      where: { id: params.id },
      data: updateData,
      include: {
        stats: true,
        simPosition: true,
        tools: {
          include: {
            tool: true
          }
        }
      }
    });

    return NextResponse.json({ agent });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update agent", 500);
  }
}
