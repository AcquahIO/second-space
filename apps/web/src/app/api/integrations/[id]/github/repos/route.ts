import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSessionFromRequest, unauthorizedJson } from "@/lib/auth/server-auth";
import { decryptCredential } from "@/lib/security/credentials";
import { jsonError } from "@/lib/utils/http";

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return unauthorizedJson();
    }

    const integration = await prisma.workspaceIntegration.findFirst({
      where: {
        id: context.params.id,
        workspaceId: session.workspaceId,
        provider: "GITHUB"
      }
    });

    if (!integration) {
      return jsonError("GitHub integration not found", 404);
    }

    if (integration.authStatus !== "CONNECTED" || !integration.accessTokenEncrypted) {
      return jsonError("GitHub integration is not connected", 400);
    }

    const token = decryptCredential(integration.accessTokenEncrypted);

    const reposResponse = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json"
      }
    });

    if (!reposResponse.ok) {
      const body = await reposResponse.text();
      return jsonError(`Could not fetch repositories: ${body || reposResponse.statusText}`, 400);
    }

    const repos = (await reposResponse.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      default_branch: string;
      owner?: { login?: string };
      permissions?: {
        admin?: boolean;
        push?: boolean;
        pull?: boolean;
      };
    }>;

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner?.login ?? "",
        private: repo.private,
        defaultBranch: repo.default_branch ?? "main",
        permissions: {
          admin: Boolean(repo.permissions?.admin),
          push: Boolean(repo.permissions?.push),
          pull: Boolean(repo.permissions?.pull)
        }
      }))
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not list GitHub repositories", 500);
  }
}
