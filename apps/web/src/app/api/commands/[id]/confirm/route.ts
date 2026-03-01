import { NextRequest, NextResponse } from "next/server";
import { confirmCommandDraft } from "@/lib/orchestration/service";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
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

    const created = await confirmCommandDraft(session.workspaceId, params.id);
    return NextResponse.json({ ok: true, tasks: created });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not confirm command", 500);
  }
}
