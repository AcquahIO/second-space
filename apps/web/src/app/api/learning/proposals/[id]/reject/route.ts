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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const proposal = await prisma.contractProposal.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!proposal) {
      return jsonError("Proposal not found", 404);
    }

    if (proposal.status !== "PENDING") {
      return NextResponse.json({ proposal });
    }

    const updated = await prisma.contractProposal.update({
      where: { id: proposal.id },
      data: {
        status: "REJECTED",
        resolvedByUserId: session.sub,
        resolvedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "LEARNING_PROPOSAL_REJECTED",
        target: updated.id
      }
    });

    await publishRealtimeEvent("learning.proposal.resolved", {
      proposalId: updated.id,
      workspaceId: updated.workspaceId,
      status: updated.status,
      title: updated.title,
      createdAt: updated.createdAt.toISOString()
    });

    return NextResponse.json({ proposal: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not reject proposal", 500);
  }
}
