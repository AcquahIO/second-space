import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";
import type { Prisma } from "@prisma/client";

const createHoldSchema = z.object({
  scope: z.enum(["TASK", "WORKSPACE"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH"),
  reason: z.string().min(3).max(500),
  taskId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const status = String(request.nextUrl.searchParams.get("status") ?? "ACTIVE");
    const holds = await prisma.securityHold.findMany({
      where: {
        workspaceId: session.workspaceId,
        status: status === "ALL" ? undefined : (status as "ACTIVE" | "RELEASED")
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 200
    });

    return NextResponse.json({ holds });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch security holds", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const payload = createHoldSchema.parse(await request.json());

    if (payload.scope === "TASK" && !payload.taskId) {
      return jsonError("taskId is required for TASK scope hold", 400);
    }

    if (payload.taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: payload.taskId,
          workspaceId: session.workspaceId
        },
        select: {
          id: true
        }
      });

      if (!task) {
        return jsonError("Task not found", 404);
      }
    }

    const hold = await prisma.$transaction(async (tx) => {
      const created = await tx.securityHold.create({
        data: {
          workspaceId: session.workspaceId,
          scope: payload.scope,
          severity: payload.severity,
          source: "MANUAL",
          reason: payload.reason.trim(),
          taskId: payload.taskId ?? null,
          metadata: payload.metadata as Prisma.InputJsonValue | undefined
        }
      });

      if (created.taskId) {
        await tx.task.update({
          where: { id: created.taskId },
          data: {
            status: "BLOCKED"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.sub,
          action: "SECURITY_HOLD_CREATED",
          target: created.id,
          metadata: {
            scope: created.scope,
            severity: created.severity,
            taskId: created.taskId
          }
        }
      });

      return created;
    });

    await publishRealtimeEvent("security.hold.placed", {
      holdId: hold.id,
      workspaceId: hold.workspaceId,
      taskId: hold.taskId,
      scope: hold.scope,
      status: hold.status,
      severity: hold.severity,
      reason: hold.reason
    });

    await publishRealtimeEvent("feed.event", {
      id: `${hold.id}:security-hold`,
      message: `Security hold placed (${hold.scope}): ${hold.reason}`,
      category: "APPROVAL",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ hold });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid hold payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not create security hold", 500);
  }
}
