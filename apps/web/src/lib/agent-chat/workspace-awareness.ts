import { prisma } from "@/lib/db/prisma";
import type { GithubWorkspaceContext, IntegrationWorkspaceContext } from "./access-guidance";

export interface WorkspaceAwarenessContext {
  roster: string;
  userContextSummary: string;
  integrationSummary: string;
  github: GithubWorkspaceContext;
  gmail: IntegrationWorkspaceContext;
  linkedin: IntegrationWorkspaceContext;
}

function buildGithubContext(integration: {
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  accountLabel: string | null;
  tokenMetadata: Record<string, unknown> | null;
} | null): GithubWorkspaceContext {
  const githubMetadata =
    integration?.tokenMetadata && typeof integration.tokenMetadata === "object"
      ? integration.tokenMetadata
      : {};
  const repoOwner = typeof githubMetadata.repoOwner === "string" ? githubMetadata.repoOwner.trim() : "";
  const repoName = typeof githubMetadata.repoName === "string" ? githubMetadata.repoName.trim() : "";
  const defaultBranch = typeof githubMetadata.defaultBranch === "string" ? githubMetadata.defaultBranch.trim() : "";
  const repoFullName = repoOwner && repoName ? `${repoOwner}/${repoName}` : null;

  return {
    connected: integration?.authStatus === "CONNECTED",
    repoFullName,
    defaultBranch: defaultBranch || null,
    accountLabel: integration?.accountLabel ?? null,
    authStatus: integration?.authStatus ?? "DISCONNECTED"
  };
}

function summarizeIntegration(integration: {
  provider: "GITHUB" | "GMAIL" | "LINKEDIN";
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  accountLabel: string | null;
  tokenMetadata: Record<string, unknown> | null;
}): string {
  if (integration.provider === "GITHUB") {
    const github = buildGithubContext(integration);

    if (github.authStatus === "DISCONNECTED") {
      return "GitHub: disconnected.";
    }

    if (github.authStatus === "ERROR") {
      return "GitHub: connected previously, but currently in an error state.";
    }

    if (github.repoFullName) {
      return `GitHub: connected${github.accountLabel ? ` (${github.accountLabel})` : ""}; bound repository ${github.repoFullName}${github.defaultBranch ? ` on ${github.defaultBranch}` : ""}.`;
    }

    return `GitHub: connected${github.accountLabel ? ` (${github.accountLabel})` : ""}; no repository bound yet.`;
  }

  const providerLabel = integration.provider === "GMAIL" ? "Gmail" : "LinkedIn";
  const statusLabel =
    integration.authStatus === "CONNECTED"
      ? `connected${integration.accountLabel ? ` (${integration.accountLabel})` : ""}`
      : integration.authStatus === "ERROR"
        ? "in error state"
        : "disconnected";

  return `${providerLabel}: ${statusLabel}.`;
}

function buildIntegrationContext(integration: {
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  accountLabel: string | null;
} | null): IntegrationWorkspaceContext {
  return {
    connected: integration?.authStatus === "CONNECTED",
    accountLabel: integration?.accountLabel ?? null,
    authStatus: integration?.authStatus ?? "DISCONNECTED"
  };
}

export async function buildWorkspaceAwareness(workspaceId: string): Promise<WorkspaceAwarenessContext> {
  const [agents, userContext, integrations] = await Promise.all([
    prisma.agent.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        name: true,
        specialistRole: true,
        specialty: true
      }
    }),
    prisma.userContext.findMany({
      where: { workspaceId },
      orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        type: true,
        title: true,
        content: true
      }
    }),
    prisma.workspaceIntegration.findMany({
      where: {
        workspaceId,
        provider: {
          in: ["GITHUB", "GMAIL", "LINKEDIN"]
        }
      },
      orderBy: {
        provider: "asc"
      },
      select: {
        provider: true,
        authStatus: true,
        accountLabel: true,
        tokenMetadata: true
      }
    })
  ]);

  const roster = agents.map((agent) => `${agent.name} (${agent.specialistRole}): ${agent.specialty}`).join("\n");
  const userContextSummary = userContext.length
    ? userContext.map((item) => `${item.type}: ${item.title} - ${item.content}`).join("\n")
    : "No explicit user context saved yet.";

  const githubIntegration = integrations.find((integration) => integration.provider === "GITHUB") ?? null;
  const gmailIntegration = integrations.find((integration) => integration.provider === "GMAIL") ?? null;
  const linkedinIntegration = integrations.find((integration) => integration.provider === "LINKEDIN") ?? null;
  const github = buildGithubContext(
    githubIntegration
      ? {
          authStatus: githubIntegration.authStatus as "DISCONNECTED" | "CONNECTED" | "ERROR",
          accountLabel: githubIntegration.accountLabel,
          tokenMetadata:
            githubIntegration.tokenMetadata && typeof githubIntegration.tokenMetadata === "object"
              ? (githubIntegration.tokenMetadata as Record<string, unknown>)
              : null
        }
      : null
  );
  const gmail = buildIntegrationContext(
    gmailIntegration
      ? {
          authStatus: gmailIntegration.authStatus as "DISCONNECTED" | "CONNECTED" | "ERROR",
          accountLabel: gmailIntegration.accountLabel
        }
      : null
  );
  const linkedin = buildIntegrationContext(
    linkedinIntegration
      ? {
          authStatus: linkedinIntegration.authStatus as "DISCONNECTED" | "CONNECTED" | "ERROR",
          accountLabel: linkedinIntegration.accountLabel
        }
      : null
  );

  const integrationSummary = integrations.length
    ? integrations
        .map((integration) =>
          summarizeIntegration({
            provider: integration.provider as "GITHUB" | "GMAIL" | "LINKEDIN",
            authStatus: integration.authStatus as "DISCONNECTED" | "CONNECTED" | "ERROR",
            accountLabel: integration.accountLabel,
            tokenMetadata:
              integration.tokenMetadata && typeof integration.tokenMetadata === "object"
                ? (integration.tokenMetadata as Record<string, unknown>)
                : null
          })
        )
        .join("\n")
    : "No workspace integrations configured yet.";

  return {
    roster,
    userContextSummary,
    integrationSummary,
    github,
    gmail,
    linkedin
  };
}
