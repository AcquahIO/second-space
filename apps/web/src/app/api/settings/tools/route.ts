import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { getToolSettings } from "@/lib/settings/tool-settings";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const settings = await getToolSettings(session.workspaceId);
    return NextResponse.json(settings);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch tool settings", 500);
  }
}
