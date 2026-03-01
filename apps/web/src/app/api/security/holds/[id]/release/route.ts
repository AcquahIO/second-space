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

    const hold = await prisma.securityHold.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!hold) {
      return jsonError("Security hold not found", 404);
    }

    if (hold.status === "RELEASED") {
      return NextResponse.json({ hold });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const released = await tx.securityHold.update({
        where: { id: hold.id },
        data: {
          status: "RELEASED",
          releasedByUserId: session.sub,
          releasedAt: new Date()
        }
      });

      if (released.taskId) {
        await tx.task.updateMany({
          where: {
            id: released.taskId,
            workspaceId: session.workspaceId,
            status: "BLOCKED"
          },
          data: {
            status: "ASSIGNED"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.sub,
          action: "SECURITY_HOLD_RELEASED",
          target: released.id,
          metadata: {
            scope: released.scope,
            taskId: released.taskId
          }
        }
      });

      return released;
    });

    await publishRealtimeEvent("security.hold.released", {
      holdId: updated.id,
      workspaceId: updated.workspaceId,
      taskId: updated.taskId,
      scope: updated.scope,
      status: updated.status,
      severity: updated.severity,
      reason: updated.reason
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId: updated.workspaceId,
      id: `${updated.id}:security-hold-release`,
      message: `Security hold released (${updated.scope})`,
      category: "APPROVAL",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ hold: updated });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not release security hold", 500);
  }
}
