import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPmConversationTurn } from "@/lib/pm-chat/service";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

const pmChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["operator", "pm", "system"]),
        content: z.string().min(1).max(8000)
      })
    )
    .min(1)
    .max(24)
});

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    await assertWorkspaceSubscriptionActive(session.workspaceId);

    const body = pmChatRequestSchema.parse(await request.json());
    const turn = await createPmConversationTurn(session.workspaceId, body.messages);
    return NextResponse.json(turn);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create PM reply", 500);
  }
}

