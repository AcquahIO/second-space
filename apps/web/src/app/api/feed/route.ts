import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { listFeed } from "@/lib/orchestration/service";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const feed = await listFeed(session.workspaceId);
    return NextResponse.json({ feed });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch feed", 500);
  }
}
