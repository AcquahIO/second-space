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

export function buildGithubAccessGuidance(
  rawOperatorContext: string,
  githubContext?: GithubWorkspaceContext | null
): string | null {
  if (!looksLikeSourceAccessRequest(rawOperatorContext)) {
    return null;
  }

  if (!githubContext?.connected) {
    return "I can help with that, but GitHub is not connected in this workspace yet. Connect the GitHub integration and bind the repository you want reviewed, or paste the relevant files, diff, or PR context here and I can work from that.";
  }

  if (!githubContext.repoFullName) {
    const accountLabel = githubContext.accountLabel ? ` for ${githubContext.accountLabel}` : "";
    return `I can help with that, and GitHub is already connected${accountLabel}, but no repository is bound yet. Pick the repository you want this workspace to use, or paste the files or diff here and I can start from that.`;
  }

  return null;
}

export function buildWorkspaceSetupGuidance(
  rawOperatorContext: string,
  setupContext: WorkspaceSetupContext
): string | null {
  const githubGuidance = buildGithubAccessGuidance(rawOperatorContext, setupContext.github);
  if (githubGuidance) {
    return githubGuidance;
  }

  if (looksLikeEmailExecutionRequest(rawOperatorContext) && !setupContext.gmail.connected) {
    return "I can help with that, but Gmail is not connected in this workspace yet. Connect Gmail if you want me to work through the inbox or send from the workspace, or I can still draft the message here for you.";
  }

  if (looksLikeLinkedInExecutionRequest(rawOperatorContext) && !setupContext.linkedin.connected) {
    return "I can help with that, but LinkedIn is not connected in this workspace yet. Connect LinkedIn if you want the team to post or message from the workspace, or I can still draft the post or outreach copy here for you.";
  }

  return null;
}
