import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";

const updateStepSchema = z.object({
  step: z.enum([
    "WORKSPACE_SETUP",
    "SUBSCRIPTION_ACTIVE",
    "KNOWLEDGE_IMPORT",
    "INTEGRATIONS_CONNECTED",
    "AGENTS_HIRED",
    "PERMISSIONS_REVIEWED",
    "LAUNCHED"
  ])
});

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = updateStepSchema.parse(await request.json());

    const workspace = await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: {
        onboardingState: body.step,
        onboardingCompletedAt: body.step === "LAUNCHED" ? new Date() : null
      }
    });

    const step = await prisma.workspaceOnboardingStep.upsert({
      where: {
        workspaceId_step: {
          workspaceId: session.workspaceId,
          step: body.step
        }
      },
      update: {
        completedAt: new Date()
      },
      create: {
        workspaceId: session.workspaceId,
        step: body.step
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "ONBOARDING_STEP_COMPLETED",
        target: body.step
      }
    });

    await publishRealtimeEvent("onboarding.step.completed", {
      workspaceId: session.workspaceId,
      step: body.step,
      completedAt: step.completedAt.toISOString()
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId: session.workspaceId,
      id: `${session.workspaceId}:onboarding:${body.step}`,
      message: `Onboarding step completed: ${body.step}`,
      category: "SYSTEM",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({ workspace, step });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid onboarding step", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not update onboarding", 500);
  }
}
