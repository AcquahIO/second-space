import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { handoffTask } from "@/lib/orchestration/service";
import { jsonError } from "@/lib/utils/http";

interface Params {
  params: {
    id: string;
  };
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const toAgentId = String(body.toAgentId ?? "");
    const reason = String(body.reason ?? "Handoff requested by operator");

    if (!toAgentId) {
      return jsonError("toAgentId is required", 400);
    }

    const task = await handoffTask(session.workspaceId, params.id, toAgentId, reason);
    return NextResponse.json({ ok: true, task });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not handoff task", 500);
  }
}
