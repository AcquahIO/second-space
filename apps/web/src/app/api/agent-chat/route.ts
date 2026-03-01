import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAgentConversationTurn } from "@/lib/agent-chat/service";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

const agentChatRequestSchema = z.object({
  agentId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["operator", "assistant", "system"]),
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

    const body = agentChatRequestSchema.parse(await request.json());
    const turn = await createAgentConversationTurn(session.workspaceId, body.agentId, body.messages);
    return NextResponse.json(turn);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not create agent reply", 500);
  }
}
