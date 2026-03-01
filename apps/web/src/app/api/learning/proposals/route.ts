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

    const status = String(request.nextUrl.searchParams.get("status") ?? "ALL");

    const proposals = await prisma.contractProposal.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: status === "ALL" ? undefined : (status as "PENDING" | "APPROVED" | "REJECTED")
      },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            specialistRole: true
          }
        },
        proposedByRun: {
          select: {
            id: true,
            createdAt: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 120
    });

    return NextResponse.json({ proposals });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch learning proposals", 500);
  }
}
