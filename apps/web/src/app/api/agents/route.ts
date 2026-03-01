import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

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
      include: {
        stats: true,
        tools: {
          include: {
            tool: true
          }
        },
        simPosition: true,
        manager: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ role: "asc" }, { name: "asc" }]
    });

    return NextResponse.json({ agents });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch agents", 500);
  }
}
