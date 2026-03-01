import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { publishRealtimeEvent } from "@/lib/realtime/publisher";
import { jsonError } from "@/lib/utils/http";

const createChatMessageSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().min(1).max(2000),
  recipientAgentId: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            role: true,
            specialistRole: true
          }
        },
        conversation: {
          include: {
            messages: {
              include: {
                senderAgent: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                recipientAgent: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              },
              orderBy: {
                createdAt: "asc"
              },
              take: 80
            }
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 60
    });

    const threads = tasks
      .map((task) => {
        const messages =
          task.conversation?.messages.map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            senderAgentId: message.senderAgentId,
            senderName: message.senderAgent?.name ?? null,
            recipientAgentId: message.recipientAgentId,
            recipientName: message.recipientAgent?.name ?? null
          })) ?? [];

        const latestMessageAt = messages[messages.length - 1]?.createdAt ?? task.updatedAt.toISOString();

        return {
          taskId: task.id,
          taskTitle: task.title,
          taskStatus: task.status,
          assignee: task.assignee,
          latestMessageAt,
          messages
        };
      })
      .sort((left, right) => Number(new Date(right.latestMessageAt)) - Number(new Date(left.latestMessageAt)));

    return NextResponse.json({ threads });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch chat threads", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = createChatMessageSchema.parse(await request.json());
    const content = body.content.trim();

    if (!content) {
      return jsonError("Message content is required");
    }

    const task = await prisma.task.findFirst({
      where: {
        id: body.taskId,
        workspaceId: session.workspaceId
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true
          }
        },
        conversation: {
          select: {
            id: true
          }
        }
      }
    });

    if (!task) {
      return jsonError("Task not found", 404);
    }

    let recipientAgentId = body.recipientAgentId?.trim() || task.assigneeId;
    if (recipientAgentId !== task.assigneeId) {
      const recipientExists = await prisma.agent.findFirst({
        where: {
          id: recipientAgentId,
          workspaceId: session.workspaceId
        },
        select: { id: true }
      });

      if (!recipientExists) {
        recipientAgentId = task.assigneeId;
      }
    }

    const projectManager = await prisma.agent.findFirst({
      where: {
        workspaceId: session.workspaceId,
        specialistRole: "PROJECT_MANAGER"
      },
      select: {
        id: true,
        name: true
      }
    });

    const shouldMirrorToPM = Boolean(projectManager && recipientAgentId !== projectManager.id);

    const message = await prisma.$transaction(async (tx) => {
      const conversation =
        task.conversation ??
        (await tx.conversation.create({
          data: {
            workspaceId: session.workspaceId,
            taskId: task.id
          }
        }));

      const created = await tx.message.create({
        data: {
          workspaceId: session.workspaceId,
          conversationId: conversation.id,
          role: "OPERATOR",
          content,
          recipientAgentId
        },
        include: {
          recipientAgent: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      await tx.taskEvent.create({
        data: {
          workspaceId: session.workspaceId,
          taskId: task.id,
          type: "OPERATOR_MESSAGE",
          message: `Operator message sent to ${created.recipientAgent?.name ?? task.assignee.name}`,
          metadata: {
            messageId: created.id
          }
        }
      });

      await tx.memoryEvent.create({
        data: {
          workspaceId: session.workspaceId,
          taskId: task.id,
          agentId: created.recipientAgentId ?? task.assigneeId,
          eventType: "CHAT_DIRECTIVE",
          content: `Operator directive to ${created.recipientAgent?.name ?? task.assignee.name}: ${content}`
        }
      });

      await tx.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          action: "CHAT_MESSAGE_SENT",
          target: task.id,
          metadata: {
            messageId: created.id,
            recipientAgentId: created.recipientAgentId
          }
        }
      });

      if (projectManager && shouldMirrorToPM) {
        await tx.message.create({
          data: {
            workspaceId: session.workspaceId,
            conversationId: conversation.id,
            role: "SYSTEM",
            content: `PM mirror: Operator instructed ${created.recipientAgent?.name ?? task.assignee.name}. Original note: ${content}`,
            recipientAgentId: projectManager.id
          }
        });

        await tx.taskEvent.create({
          data: {
            workspaceId: session.workspaceId,
            taskId: task.id,
            type: "PM_ROUTING_MIRROR",
            message: `Instruction mirrored to PM (${projectManager.name}) for orchestration tracking`,
            metadata: {
              mirroredToAgentId: projectManager.id,
              originalRecipientAgentId: created.recipientAgentId
            }
          }
        });

        await tx.memoryEvent.create({
          data: {
            workspaceId: session.workspaceId,
            taskId: task.id,
            agentId: projectManager.id,
            eventType: "CHAT_DIRECTIVE",
            content: `PM mirrored instruction for orchestration tracking. Recipient: ${created.recipientAgent?.name ?? task.assignee.name}`
          }
        });
      }

      return created;
    });

    await publishRealtimeEvent("feed.event", {
      workspaceId: session.workspaceId,
      id: `${task.id}:chat:${message.id}`,
      message: `Operator pinged ${message.recipientAgent?.name ?? task.assignee.name} on ${task.title}`,
      category: "TASK",
      createdAt: new Date().toISOString()
    });

    return NextResponse.json({
      message: {
        id: message.id,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        recipientAgentId: message.recipientAgentId,
        recipientName: message.recipientAgent?.name ?? null
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid chat payload");
    }

    return jsonError(error instanceof Error ? error.message : "Could not send chat message", 500);
  }
}
