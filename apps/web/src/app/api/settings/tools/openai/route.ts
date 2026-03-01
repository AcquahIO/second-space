import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { updateOpenAITool } from "@/lib/settings/tool-settings";
import { jsonError } from "@/lib/utils/http";

export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const rawKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKey = rawKey.length ? rawKey : null;
    const model = String(body.model ?? "gpt-4.1-mini").trim();

    const openai = await updateOpenAITool(session.workspaceId, apiKey, model || "gpt-4.1-mini");
    return NextResponse.json({ openai });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update OpenAI settings", 500);
  }
}
