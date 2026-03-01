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

    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      include: {
        subscription: true,
        onboardingProgress: {
          orderBy: {
            completedAt: "desc"
          }
        }
      }
    });

    if (!workspace) {
      return jsonError("Workspace not found", 404);
    }

    return NextResponse.json({
      onboardingState: workspace.onboardingState,
      onboardingCompletedAt: workspace.onboardingCompletedAt,
      subscription: workspace.subscription,
      steps: workspace.onboardingProgress
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load onboarding", 500);
  }
}
