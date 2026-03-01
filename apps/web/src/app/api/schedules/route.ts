import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { parseNaturalLanguageSchedule } from "@/lib/scheduling/natural-language";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const schedules = await prisma.schedule.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch schedules", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const name = String(body.name ?? "Scheduled mission").trim();
    const prompt = String(body.prompt ?? "").trim();
    const naturalLanguage = String(body.naturalLanguage ?? "").trim();
    const timezone = String(body.timezone ?? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
    const leadAgentId = body.leadAgentId ? String(body.leadAgentId) : null;

    if (!prompt || !naturalLanguage) {
      return jsonError("prompt and naturalLanguage are required", 400);
    }

    await assertWorkspaceSubscriptionActive(session.workspaceId);

    const parsed = parseNaturalLanguageSchedule(naturalLanguage, timezone);

    const schedule = await prisma.schedule.create({
      data: {
        workspaceId: session.workspaceId,
        leadAgentId,
        name,
        prompt,
        naturalLanguage,
        recurrence: parsed.recurrence,
        timezone,
        enabled: true,
        nextRunAt: new Date(parsed.nextRunAt)
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "SCHEDULE_CREATED",
        target: schedule.id,
        metadata: {
          recurrence: schedule.recurrence
        }
      }
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create schedule", 500);
  }
}
