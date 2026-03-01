import type { WorkspaceActionHint } from "@second-space/shared-types";

export interface GithubWorkspaceContext {
  connected: boolean;
  repoFullName: string | null;
  defaultBranch: string | null;
  accountLabel: string | null;
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
}

export interface IntegrationWorkspaceContext {
  connected: boolean;
  accountLabel: string | null;
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
}

export interface WorkspaceSetupContext {
  github: GithubWorkspaceContext;
  gmail: IntegrationWorkspaceContext;
  linkedin: IntegrationWorkspaceContext;
}

export interface WorkspaceSetupGuidance {
  reply: string;
  actionHints: WorkspaceActionHint[];
}

function looksLikeSourceAccessRequest(rawOperatorContext: string): boolean {
  return /\b(code review|review my code|review the code|review this code|review our code|review the repo|review repository|look at my code|audit the code|audit my code|review a pr|review this pr|inspect the repo|check the codebase|look through the repo|look through the repository|review the pull request|check the branch|look at the diff)\b/i.test(
    rawOperatorContext
  );
}

function looksLikeEmailExecutionRequest(rawOperatorContext: string): boolean {
  return /\b(send (an |this |that |the )?email|email (the|our|this|that)|reply to (the )?email|follow up (by|via) email|draft (an |this |that |the )?email|gmail|inbox)\b/i.test(
    rawOperatorContext
  );
}

function looksLikeLinkedInExecutionRequest(rawOperatorContext: string): boolean {
  return /\b(linkedin|post (this )?on linkedin|publish (this )?on linkedin|message on linkedin|linkedin outreach|linkedin dm)\b/i.test(
    rawOperatorContext
  );
}

function baseIntegrationHints(): WorkspaceActionHint[] {
  return [
    {
      type: "OPEN_INTEGRATIONS",
      label: "Open Integrations",
      description: "Open workspace integrations to connect or fix the required account."
    }
  ];
}

export function buildGithubAccessGuidance(
  rawOperatorContext: string,
  githubContext?: GithubWorkspaceContext | null
): WorkspaceSetupGuidance | null {
  if (!looksLikeSourceAccessRequest(rawOperatorContext)) {
    return null;
  }

  if (!githubContext?.connected) {
    return {
      reply:
        "I can help with that, but GitHub is not connected in this workspace yet. Connect the GitHub integration and bind the repository you want reviewed, or paste the relevant files, diff, or PR context here and I can work from that.",
      actionHints: [
        {
          type: "CONNECT_GITHUB",
          label: "Connect GitHub",
          description: "Authorize this workspace to access your repositories."
        },
        ...baseIntegrationHints(),
        {
          type: "UPLOAD_SOURCE_FILES",
          label: "Upload Files Instead",
          description: "Use a manual fallback by sharing the relevant files or diff directly."
        }
      ]
    };
  }

  if (!githubContext.repoFullName) {
    const accountLabel = githubContext.accountLabel ? ` for ${githubContext.accountLabel}` : "";
    return {
      reply: `I can help with that, and GitHub is already connected${accountLabel}, but no repository is bound yet. Pick the repository you want this workspace to use, or paste the files or diff here and I can start from that.`,
      actionHints: [
        {
          type: "BIND_GITHUB_REPO",
          label: "Bind Repo",
          description: "Choose the GitHub repository this workspace should use."
        },
        ...baseIntegrationHints(),
        {
          type: "UPLOAD_SOURCE_FILES",
          label: "Upload Files Instead",
          description: "Share the relevant files or diff directly if you do not want to bind a repo yet."
        }
      ]
    };
  }

  return null;
}

export function buildWorkspaceSetupGuidance(
  rawOperatorContext: string,
  setupContext: WorkspaceSetupContext
): WorkspaceSetupGuidance | null {
  const githubGuidance = buildGithubAccessGuidance(rawOperatorContext, setupContext.github);
  if (githubGuidance) {
    return githubGuidance;
  }

  if (looksLikeEmailExecutionRequest(rawOperatorContext) && !setupContext.gmail.connected) {
    return {
      reply:
        "I can help with that, but Gmail is not connected in this workspace yet. Connect Gmail if you want me to work through the inbox or send from the workspace, or I can still draft the message here for you.",
      actionHints: [
        ...baseIntegrationHints(),
        {
          type: "OPEN_KNOWLEDGE_PANEL",
          label: "Open Knowledge Panel",
          description: "Use the workspace knowledge flow if you want to attach reference material instead."
        }
      ]
    };
  }

  if (looksLikeLinkedInExecutionRequest(rawOperatorContext) && !setupContext.linkedin.connected) {
    return {
      reply:
        "I can help with that, but LinkedIn is not connected in this workspace yet. Connect LinkedIn if you want the team to post or message from the workspace, or I can still draft the post or outreach copy here for you.",
      actionHints: baseIntegrationHints()
    };
  }

  return null;
}
