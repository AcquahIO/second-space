import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { rejectTask } from "@/lib/orchestration/service";
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

    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason ?? "Approval rejected by operator");

    await rejectTask(session.workspaceId, params.id, session.sub, reason);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not reject task", 500);
  }
}
