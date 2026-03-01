import { NextRequest } from "next/server";
import { z } from "zod";
import { createAgentConversationTurn } from "@/lib/agent-chat/service";
import { assertWorkspaceSubscriptionActive, getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import type { AgentChatFinalMessage, AgentChatStreamEvent } from "@second-space/shared-types";

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

const encoder = new TextEncoder();

function serializeEvent(event: string, data: AgentChatStreamEvent): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function splitReplyIntoChunks(reply: string): string[] {
  const words = reply.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let buffer = "";

  for (const word of words) {
    if ((buffer + word).length > 32 && buffer) {
      chunks.push(buffer);
      buffer = word;
      continue;
    }

    buffer += word;
  }

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks.length ? chunks : [reply];
}

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session) {
    return unauthorizedJson();
  }

  try {
    await assertWorkspaceSubscriptionActive(session.workspaceId);
    const body = agentChatRequestSchema.parse(await request.json());
    const turn = await createAgentConversationTurn(session.workspaceId, body.agentId, body.messages);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for (const token of splitReplyIntoChunks(turn.reply)) {
            controller.enqueue(
              serializeEvent("token", {
                type: "token",
                token
              })
            );
            await new Promise((resolve) => setTimeout(resolve, 12));
          }

          const finalMessage: AgentChatFinalMessage = {
            reply: turn.reply,
            readyToExecute: turn.readyToExecute,
            draftId: turn.draftId,
            actionHints: turn.actionHints
          };

          controller.enqueue(
            serializeEvent("final", {
              type: "final",
              message: finalMessage
            })
          );
        } catch (error) {
          controller.enqueue(
            serializeEvent("error", {
              type: "error",
              error: error instanceof Error ? error.message : "Could not stream agent reply"
            })
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          serializeEvent("error", {
            type: "error",
            error: error instanceof Error ? error.message : "Could not create agent reply"
          })
        );
        controller.close();
      }
    });

    return new Response(stream, {
      status: 500,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform"
      }
    });
  }
}
