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

    const runs = await prisma.learningReflectionRun.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            specialistRole: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 80
    });

    return NextResponse.json({ runs });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch reflection runs", 500);
  }
}
