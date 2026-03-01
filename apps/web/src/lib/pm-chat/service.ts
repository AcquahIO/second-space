import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createCommandDraft } from "@/lib/orchestration/service";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";
import { AGENT_CONTRACTS, type CommandMode, type WorkspaceActionHint } from "@second-space/shared-types";
import { buildFallbackPmTurn } from "./fallback";
import { buildWorkspaceSetupGuidance } from "@/lib/agent-chat/access-guidance";
import { buildWorkspaceAwareness } from "@/lib/agent-chat/workspace-awareness";

const PM_MESSAGE_ROLE = z.enum(["operator", "pm", "system"]);

const pmConversationMessageSchema = z.object({
  role: PM_MESSAGE_ROLE,
  content: z.string().min(1).max(8000)
});

const pmModelOutputSchema = z.object({
  reply: z.string().min(1),
  readyToExecute: z.boolean(),
  mode: z.enum(["explore", "plan", "execute", "review"]),
  normalizedCommand: z.string().min(1),
  intentTitle: z.string().min(1).max(140).optional()
});

export type PmConversationMessage = z.infer<typeof pmConversationMessageSchema>;

export interface PmConversationTurn {
  reply: string;
  readyToExecute: boolean;
  draftId: string | null;
  actionHints: WorkspaceActionHint[];
}

function getOpenAIClient(config: { apiKey: string } | null): OpenAI | null {
  if (!config?.apiKey) {
    return null;
  }

  return new OpenAI({ apiKey: config.apiKey });
}

function extractJsonPayload(text: string): unknown {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? text.trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("Could not parse PM model response");
  }
}

function buildOperatorContext(messages: PmConversationMessage[]): string {
  return messages
    .filter((message) => message.role === "operator")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .slice(-6)
    .join("\n");
}

async function resolveOpenAIConfig(workspaceId: string): Promise<{ apiKey: string; model: string } | null> {
  const openaiTool = await prisma.tool.findFirst({
    where: { workspaceId, provider: "openai" },
    select: {
      config: true
    }
  });

  const config = (openaiTool?.config as Record<string, unknown> | null) ?? {};
  const apiKey = String(config.apiKey ?? getRuntimeEnv("OPENAI_API_KEY") ?? "").trim();
  const model = String(config.model ?? getRuntimeEnv("OPENAI_MODEL") ?? "gpt-4.1-mini").trim();

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model
  };
}

async function runModelConversationTurn(
  workspaceId: string,
  messages: PmConversationMessage[]
): Promise<{
  reply: string;
  readyToExecute: boolean;
  mode: CommandMode;
  normalizedCommand: string;
  actionHints: WorkspaceActionHint[];
}> {
  const pmContract = AGENT_CONTRACTS.PROJECT_MANAGER;
  const openaiConfig = await resolveOpenAIConfig(workspaceId);
  const operatorContext = buildOperatorContext(messages);

  if (!operatorContext) {
    return {
      reply: "Tell me what you want to get done, and I’ll help shape it into something the team can run.",
      readyToExecute: false,
      mode: "explore",
      normalizedCommand: "Clarify the mission objective and constraints.",
      actionHints: []
    };
  }

  const workspaceAwareness = await buildWorkspaceAwareness(workspaceId);
  const setupGuidance = buildWorkspaceSetupGuidance(operatorContext, workspaceAwareness);
  if (setupGuidance) {
    return {
      reply: setupGuidance.reply,
      readyToExecute: false,
      mode: "execute",
      normalizedCommand: operatorContext,
      actionHints: setupGuidance.actionHints
    };
  }

  if (!openaiConfig) {
    return buildFallbackPmTurn(operatorContext, { github: workspaceAwareness.github });
  }

  const client = getOpenAIClient(openaiConfig);
  if (!client) {
    return buildFallbackPmTurn(operatorContext, { github: workspaceAwareness.github });
  }

  const transcript = messages
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) => `${message.role === "operator" ? "Operator" : "PM"}: ${message.content}`)
    .join("\n\n");

  const systemPrompt = [
    "You are the Project Manager / Orchestrator agent for a workspace called Second Space.",
    `Soul: ${pmContract.soul}`,
    `Identity: ${pmContract.identity}`,
    `Operating principle: ${pmContract.operatingPrinciple ?? "Be strategic first, then operational."}`,
    "",
    "Your job is to converse like a strong human PM, not like a parser or workflow wizard.",
    "Speak naturally, with concise but human responses similar to ChatGPT.",
    "Do not mention internal labels like mode, classification, parser, command draft, workflow state, or task graph unless the user explicitly asks.",
    "Ask only the minimum clarifying questions required to run the mission well.",
    "When you already have enough context, say so naturally and indicate you are ready to start when the user presses Go.",
    "Use 'review' mode only for end-of-mission synthesis, retrospectives, or summaries of completed work.",
    "For requests like code review, product review, or audit work that still require delegation, prefer 'execute'.",
    "If the user is just thinking out loud or exploring options, prefer 'explore' or 'plan'.",
    "Before proposing execution, check whether the required workspace connection already exists.",
    "GitHub is required for code review, repository analysis, PR review, and source-level work unless the user shares files or diffs manually.",
    "Gmail is required for inbox actions or sending from the workspace unless the user only wants drafted copy.",
    "LinkedIn is required for posting or messaging from the workspace unless the user only wants drafted copy.",
    "If a needed connection is missing, say that directly and suggest the exact connection or a manual fallback.",
    "If GitHub is connected but no repository is bound, say that directly and ask the user to pick the repository or share files/diffs manually.",
    "If a repository is already bound, refer to it naturally when relevant.",
    "Never expose chain-of-thought. Return only the requested JSON object.",
    "",
    "[Available Team]",
    workspaceAwareness.roster,
    "",
    "[Workspace Integrations]",
    workspaceAwareness.integrationSummary,
    "",
    "[User Context]",
    workspaceAwareness.userContextSummary,
    "",
    "[Output JSON schema]",
    "{",
    '  "reply": "natural PM reply to the user",',
    '  "readyToExecute": true,',
    '  "mode": "explore|plan|execute|review",',
    '  "normalizedCommand": "clean internal mission brief",',
    '  "intentTitle": "short mission title"',
    "}"
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: openaiConfig.model,
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `[Conversation Transcript]\n${transcript}\n\n[Latest Operator Intent Summary]\n${operatorContext}`
        }
      ]
    });

    const parsed = pmModelOutputSchema.parse(extractJsonPayload(response.output_text));

    return {
      reply: parsed.reply.trim(),
      readyToExecute: parsed.readyToExecute,
      mode: parsed.mode,
      normalizedCommand: parsed.normalizedCommand.trim(),
      actionHints: []
    };
  } catch {
    return buildFallbackPmTurn(operatorContext, { github: workspaceAwareness.github });
  }
}

export async function createPmConversationTurn(
  workspaceId: string,
  messages: PmConversationMessage[]
): Promise<PmConversationTurn> {
  const validatedMessages = z.array(pmConversationMessageSchema).min(1).max(24).parse(messages);
  const result = await runModelConversationTurn(workspaceId, validatedMessages);

  let draftId: string | null = null;
  if (result.readyToExecute && result.normalizedCommand.trim()) {
    const draft = await createCommandDraft(workspaceId, result.normalizedCommand, result.mode);
    draftId = draft.id;
  }

  return {
    reply: result.reply,
    readyToExecute: result.readyToExecute,
    draftId,
    actionHints: result.actionHints
  };
}
