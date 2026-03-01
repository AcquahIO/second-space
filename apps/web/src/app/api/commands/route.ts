import { NextRequest, NextResponse } from "next/server";
import { createCommandDraft } from "@/lib/orchestration/service";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";
import type { CommandMode } from "@second-space/shared-types";

const VALID_MODES = new Set<CommandMode>(["explore", "plan", "execute", "review"]);

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = await request.json();
    const text = String(body.text ?? "").trim();
    const modeInput = typeof body.mode === "string" ? body.mode.trim().toLowerCase() : "";
    const mode: CommandMode | undefined = VALID_MODES.has(modeInput as CommandMode) ? (modeInput as CommandMode) : undefined;

    if (!text) {
      return jsonError("Command text is required", 400);
    }

    await assertWorkspaceSubscriptionActive(session.workspaceId);

    const draft = await createCommandDraft(session.workspaceId, text, mode);
    return NextResponse.json(draft);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not parse command", 500);
  }
}
