import type { WorkspaceActionHint } from "@second-space/shared-types";
import { parseCommandText } from "../commands/parser";
import type { CommandMode } from "@second-space/shared-types";
import { buildGithubAccessGuidance, type GithubWorkspaceContext } from "../agent-chat/access-guidance";

export { buildGithubAccessGuidance, type GithubWorkspaceContext } from "../agent-chat/access-guidance";

export interface FallbackPmTurn {
  reply: string;
  readyToExecute: boolean;
  mode: CommandMode;
  normalizedCommand: string;
  actionHints: WorkspaceActionHint[];
}

export function buildFallbackPmTurn(
  rawOperatorContext: string,
  options?: {
    github?: GithubWorkspaceContext | null;
  }
): FallbackPmTurn {
  const githubGuidance = buildGithubAccessGuidance(rawOperatorContext, options?.github);
  if (githubGuidance) {
    return {
      reply: githubGuidance.reply,
      readyToExecute: false,
      mode: "execute",
      normalizedCommand: rawOperatorContext,
      actionHints: githubGuidance.actionHints
    };
  }

  const parsed = parseCommandText(rawOperatorContext);
  const questions = parsed.clarifyingQuestions.slice(0, 2);

  if (questions.length) {
    const reply = [
      "I can help with that. Before I start, I need a bit more direction:",
      ...questions.map((question, index) => `${index + 1}. ${question}`)
    ].join("\n");

    return {
      reply,
      readyToExecute: false,
      mode: parsed.mode,
      normalizedCommand: rawOperatorContext,
      actionHints: []
    };
  }

  return {
    reply: "I understand what you want. I’m ready to start and delegate this when you press Go.",
    readyToExecute: true,
    mode: parsed.mode,
    normalizedCommand: rawOperatorContext,
    actionHints: []
  };
}
