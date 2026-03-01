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

    const sources = await prisma.knowledgeSource.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        _count: {
          select: {
            chunks: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      }
    });

    return NextResponse.json({ sources });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch knowledge sources", 500);
  }
}
