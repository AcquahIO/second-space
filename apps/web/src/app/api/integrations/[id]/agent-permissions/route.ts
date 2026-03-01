import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { jsonError } from "@/lib/utils/http";

const patchPermissionsSchema = z.object({
  permissions: z.array(
    z.object({
      agentId: z.string().min(1),
      capabilities: z.array(z.enum(["READ", "WRITE", "POST", "SEND", "COMMIT", "PUSH"]))
    })
  )
});

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const body = patchPermissionsSchema.parse(await request.json());

    const integration = await prisma.workspaceIntegration.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId
      },
      select: {
        id: true
      }
    });

    if (!integration) {
      return jsonError("Integration not found", 404);
    }

    const agentIds = body.permissions.map((permission) => permission.agentId);
    const validAgents = await prisma.agent.findMany({
      where: {
        workspaceId: session.workspaceId,
        id: {
          in: agentIds
        }
      },
      select: {
        id: true
      }
    });

    const validAgentIdSet = new Set(validAgents.map((agent) => agent.id));

    await prisma.$transaction(async (tx) => {
      await tx.agentIntegrationPermission.deleteMany({
        where: {
          workspaceIntegrationId: integration.id
        }
      });

      for (const permission of body.permissions) {
        if (!validAgentIdSet.has(permission.agentId)) {
          continue;
        }

        await tx.agentIntegrationPermission.create({
          data: {
            workspaceIntegrationId: integration.id,
            agentId: permission.agentId,
            capabilities: permission.capabilities
          }
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.sub,
          action: "INTEGRATION_AGENT_PERMISSIONS_UPDATED",
          target: integration.id,
          metadata: {
            permissionCount: body.permissions.length
          }
        }
      });
    });

    const permissions = await prisma.agentIntegrationPermission.findMany({
      where: {
        workspaceIntegrationId: integration.id
      }
    });

    return NextResponse.json({ permissions });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid permissions payload", 400);
    }

    return jsonError(error instanceof Error ? error.message : "Could not update permissions", 500);
  }
}
