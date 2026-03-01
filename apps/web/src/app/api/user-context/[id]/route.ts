import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

interface RouteContext {
  params: {
    id: string;
  };
}

const updateUserContextSchema = z.object({
  type: z
    .enum([
      "GOAL",
      "PREFERENCE",
      "STRENGTH",
      "WEAKNESS",
      "BUSINESS_CONTEXT",
      "PRODUCT_CONTEXT",
      "WORKING_STYLE"
    ])
    .optional(),
  title: z.string().min(1).max(120).optional(),
  content: z.string().min(1).max(2000).optional(),
  weight: z.number().int().min(0).max(100).optional()
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const existing = await prisma.userContext.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!existing) {
      return jsonError("User context not found", 404);
    }

    const payload = updateUserContextSchema.parse(await request.json());

    const updated = await prisma.userContext.update({
      where: { id: existing.id },
      data: {
        type: payload.type ?? existing.type,
        title: payload.title?.trim() ?? existing.title,
        content: payload.content?.trim() ?? existing.content,
        weight: payload.weight ?? existing.weight
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "USER_CONTEXT_UPDATED",
        target: updated.id
      }
    });

    return NextResponse.json({ context: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid user context payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not update user context", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const existing = await prisma.userContext.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      }
    });

    if (!existing) {
      return jsonError("User context not found", 404);
    }

    await prisma.userContext.delete({
      where: {
        id: existing.id
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "USER_CONTEXT_DELETED",
        target: existing.id
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete user context", 500);
  }
}
