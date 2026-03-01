import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

const createUserContextSchema = z.object({
  type: z.enum([
    "GOAL",
    "PREFERENCE",
    "STRENGTH",
    "WEAKNESS",
    "BUSINESS_CONTEXT",
    "PRODUCT_CONTEXT",
    "WORKING_STYLE"
  ]),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(2000),
  weight: z.number().int().min(0).max(100).optional()
});

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const contexts = await prisma.userContext.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      orderBy: [{ weight: "desc" }, { updatedAt: "desc" }]
    });

    return NextResponse.json({ contexts });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch user context", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const payload = createUserContextSchema.parse(await request.json());

    const context = await prisma.userContext.create({
      data: {
        workspaceId: session.workspaceId,
        createdByUserId: session.sub,
        type: payload.type,
        title: payload.title.trim(),
        content: payload.content.trim(),
        weight: payload.weight ?? 50
      }
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.sub,
        action: "USER_CONTEXT_CREATED",
        target: context.id,
        metadata: {
          type: context.type,
          weight: context.weight
        }
      }
    });

    return NextResponse.json({ context });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid user context payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not create user context", 500);
  }
}
