import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const integrations = await prisma.workspaceIntegration.findMany({
      where: {
        workspaceId: session.workspaceId
      },
      include: {
        agentPermissions: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                specialistRole: true
              }
            }
          }
        }
      },
      orderBy: {
        provider: "asc"
      }
    });

    const sanitized = integrations.map((integration) => ({
      id: integration.id,
      workspaceId: integration.workspaceId,
      provider: integration.provider,
      authStatus: integration.authStatus,
      accountLabel: integration.accountLabel,
      capabilities: integration.capabilities,
      expiresAt: integration.expiresAt,
      tokenMetadata: integration.tokenMetadata,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      agentPermissions: integration.agentPermissions
    }));

    return NextResponse.json({ integrations: sanitized });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not fetch integrations", 500);
  }
}
