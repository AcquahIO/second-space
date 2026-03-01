import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createWorkspacePresentationToken } from "@/lib/auth/session";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";
import type { PresentationChannel } from "@second-space/shared-types";

const presentationSessionRequestSchema = z.object({
  channel: z.enum(["dashboard", "presentation"]).optional()
});

function getPresentationWebsocketUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const workerPort = process.env.WORKER_PORT?.trim() || "4001";
  return `ws://localhost:${workerPort}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    await assertWorkspaceSubscriptionActive(session.workspaceId);

    const rawBody = await request.text();
    const body = presentationSessionRequestSchema.parse(rawBody ? JSON.parse(rawBody) : {});
    const channel: PresentationChannel = body.channel ?? "dashboard";
    const issued = createWorkspacePresentationToken({
      sub: session.sub,
      workspaceId: session.workspaceId,
      channel
    });

    return NextResponse.json({
      websocketUrl: getPresentationWebsocketUrl(),
      presentationToken: issued.token,
      expiresAt: issued.expiresAt,
      channel
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create presentation session", 500);
  }
}
