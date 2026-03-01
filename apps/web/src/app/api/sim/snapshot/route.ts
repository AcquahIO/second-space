import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { prisma } from "@/lib/db/prisma";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const positions = await prisma.simPosition.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            role: true,
            state: true
          }
        }
      }
    });

    return NextResponse.json({ positions });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch simulation snapshot", 500);
  }
}
