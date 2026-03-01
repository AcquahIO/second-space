import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseNaturalLanguageSchedule } from "@/lib/scheduling/natural-language";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const existing = await prisma.schedule.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!existing) {
      return jsonError("Schedule not found", 404);
    }

    const body = await request.json();
    const naturalLanguage =
      typeof body.naturalLanguage === "string" ? body.naturalLanguage.trim() : existing.naturalLanguage;
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : existing.timezone;
    const parsed = parseNaturalLanguageSchedule(naturalLanguage, timezone);

    const schedule = await prisma.schedule.update({
      where: {
        id: existing.id
      },
      data: {
        name: typeof body.name === "string" ? body.name.trim() || existing.name : existing.name,
        prompt: typeof body.prompt === "string" ? body.prompt.trim() || existing.prompt : existing.prompt,
        naturalLanguage,
        timezone,
        recurrence: parsed.recurrence,
        nextRunAt: new Date(parsed.nextRunAt),
        enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
        leadAgentId: body.leadAgentId === null ? null : typeof body.leadAgentId === "string" ? body.leadAgentId : existing.leadAgentId
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "SCHEDULE_UPDATED",
        target: schedule.id
      }
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update schedule", 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: { id: string } }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const existing = await prisma.schedule.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return jsonError("Schedule not found", 404);
    }

    await prisma.schedule.delete({
      where: {
        id: existing.id
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "SCHEDULE_DELETED",
        target: existing.id
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete schedule", 500);
  }
}
