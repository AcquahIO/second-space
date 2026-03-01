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

    const updated = await prisma.$transaction(async (tx) => {
      const approved = await tx.contractProposal.update({
        where: { id: proposal.id },
        data: {
          status: "APPROVED",
          resolvedByUserId: session.sub,
          resolvedAt: new Date()
        }
      });

      let contractVersion = 1;
      if (approved.agentId) {
        const approvedCount = await tx.contractProposal.count({
          where: {
            workspaceId: approved.workspaceId,
            agentId: approved.agentId,
            status: "APPROVED"
          }
        });
        contractVersion = approvedCount + 1;

        await tx.agentMemory.create({
          data: {
            workspaceId: approved.workspaceId,
            agentId: approved.agentId,
            content: `Approved contract snapshot v${contractVersion}: ${approved.title}. ${approved.rationale}`
          }
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.sub,
          action: "LEARNING_PROPOSAL_APPROVED",
          target: approved.id
        }
      });

      return { approved, contractVersion };
    });

    await publishRealtimeEvent("learning.proposal.resolved", {
      proposalId: updated.approved.id,
      workspaceId: updated.approved.workspaceId,
      status: updated.approved.status,
      title: updated.approved.title,
      contractVersion: updated.contractVersion,
      createdAt: updated.approved.createdAt.toISOString()
    });

    return NextResponse.json({ proposal: updated.approved, contractVersion: updated.contractVersion });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not approve proposal", 500);
  }
}
