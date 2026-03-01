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

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            role: true,
            specialistRole: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            role: true,
            specialistRole: true
          }
        },
        approvals: true,
        events: {
          orderBy: {
            createdAt: "desc"
          },
          take: 6
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch tasks", 500);
  }
}
