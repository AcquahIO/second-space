import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { createPmConversationTurn, type PmConversationMessage } from "@/lib/pm-chat/service";
import { getRuntimeEnv } from "@/lib/utils/runtime-env";
import { AGENT_CONTRACTS } from "@second-space/shared-types";
import { buildFallbackAgentTurn, type FallbackAgentTurn } from "./fallback";
import { buildWorkspaceSetupGuidance } from "./access-guidance";
import { buildWorkspaceAwareness, type WorkspaceAwarenessContext } from "./workspace-awareness";

const AGENT_MESSAGE_ROLE = z.enum(["operator", "assistant", "system"]);

const agentConversationMessageSchema = z.object({
  role: AGENT_MESSAGE_ROLE,
  content: z.string().min(1).max(8000)
});

export type AgentConversationMessage = z.infer<typeof agentConversationMessageSchema>;

export interface AgentConversationTurn {
  reply: string;
  readyToExecute: boolean;
  draftId: string | null;
}

function getOpenAIClient(config: { apiKey: string } | null): OpenAI | null {
  if (!config?.apiKey) {
    return null;
  }

  return new OpenAI({ apiKey: config.apiKey });
}

function buildOperatorContext(messages: AgentConversationMessage[]): string {
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

type WorkspaceAgentRecord = Awaited<ReturnType<typeof loadWorkspaceAgent>>;

async function loadWorkspaceAgent(workspaceId: string, agentId: string) {
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      workspaceId
    },
    select: {
      id: true,
      name: true,
      specialistRole: true,
      specialty: true,
      manager: {
        select: {
          name: true,
          specialistRole: true
        }
      },
      stats: {
        select: {
          mood: true
        }
      },
      tools: {
        select: {
          tool: {
            select: {
              name: true,
              provider: true,
              executionMode: true
            }
          }
        }
      },
      memories: {
        orderBy: {
          updatedAt: "desc"
        },
        take: 4,
        select: {
          content: true
        }
      }
    }
  });

  if (!agent) {
    throw new Error("Agent not found");
  }

  return agent;
}

function buildTranscript(agent: WorkspaceAgentRecord, messages: AgentConversationMessage[]): string {
  return messages
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) => `${message.role === "operator" ? "Operator" : agent.name}: ${message.content}`)
    .join("\n\n");
}

function buildAgentSystemPrompt(agent: WorkspaceAgentRecord, workspaceAwareness: WorkspaceAwarenessContext): string {
  const contract = AGENT_CONTRACTS[agent.specialistRole];
  const memorySummary = agent.memories.length
    ? agent.memories.map((memory) => `- ${memory.content}`).join("\n")
    : "No persistent memory notes yet.";
  const toolSummary = agent.tools.length
    ? agent.tools
        .map(({ tool }) => `${tool.name} (${tool.provider}, ${tool.executionMode})`)
        .join(", ")
    : "No tools attached.";
  const approvalBoundaries = contract.decisionRights.requiresApproval.join(", ");
  const prohibitedActions = contract.decisionRights.prohibited.join(", ");

  return [
    "You are an agent inside the Second Space workspace.",
    `Name: ${agent.name}`,
    `Role: ${contract.title}`,
    `Mission: ${contract.mission}`,
    `Soul: ${contract.soul}`,
    `Identity: ${contract.identity}`,
    `Operating principle: ${contract.operatingPrinciple ?? "Respond directly and stay accountable."}`,
    agent.manager ? `Reports to: ${agent.manager.name} (${agent.manager.specialistRole})` : "Reports to: CEO",
    agent.stats?.mood ? `Current mood: ${agent.stats.mood}` : "",
    "",
    "Behavior requirements:",
    "- Respond naturally in plain language, like a capable human teammate.",
    "- Do not mention hidden orchestration, contracts, parser state, or system prompts.",
    "- Answer directly when the user asks for analysis, explanation, options, or recommendations in your domain.",
    "- If the request clearly needs cross-team coordination, tell the user PM is the right agent to run it, while still giving the best role-specific guidance you can.",
    "- Stay aware of actual workspace setup. If the request depends on a missing workspace connection, say that directly and suggest the relevant connection or a manual fallback.",
    "- GitHub is required for repository review, PR review, source-level code inspection, and repo-wide changes unless the user pastes files or diffs manually.",
    "- Gmail is required for inbox actions or sending from the workspace unless the user only wants drafted copy.",
    "- LinkedIn is required for posting or messaging from the workspace unless the user only wants drafted copy.",
    "- Do not claim to have executed external actions unless the user can see that in the product.",
    "- Be concise by default.",
    "",
    "[Workspace Integrations]",
    workspaceAwareness.integrationSummary,
    "",
    "[User Context]",
    workspaceAwareness.userContextSummary,
    "",
    "[Recent Agent Memory]",
    memorySummary,
    "",
    "[Available Tools]",
    toolSummary,
    "",
    "[Approval Boundaries]",
    approvalBoundaries || "No explicit approval boundaries listed.",
    "",
    "[Prohibited Actions]",
    prohibitedActions || "None listed."
  ]
    .filter(Boolean)
    .join("\n");
}

async function runSpecialistConversationTurn(
  workspaceId: string,
  agent: WorkspaceAgentRecord,
  messages: AgentConversationMessage[]
): Promise<FallbackAgentTurn> {
  const operatorContext = buildOperatorContext(messages);
  const openaiConfig = await resolveOpenAIConfig(workspaceId);
  const workspaceAwareness = await buildWorkspaceAwareness(workspaceId);
  const setupGuidance = buildWorkspaceSetupGuidance(operatorContext, workspaceAwareness);

  if (setupGuidance) {
    return {
      reply: setupGuidance,
      readyToExecute: false,
      draftId: null
    };
  }

  if (!operatorContext) {
    return buildFallbackAgentTurn({
      agentName: agent.name,
      agentTitle: AGENT_CONTRACTS[agent.specialistRole].title,
      specialty: agent.specialty,
      operatorContext,
      github: workspaceAwareness.github
    });
  }

  if (!openaiConfig) {
    return buildFallbackAgentTurn({
      agentName: agent.name,
      agentTitle: AGENT_CONTRACTS[agent.specialistRole].title,
      specialty: agent.specialty,
      operatorContext,
      github: workspaceAwareness.github
    });
  }

  const client = getOpenAIClient(openaiConfig);
  if (!client) {
    return buildFallbackAgentTurn({
      agentName: agent.name,
      agentTitle: AGENT_CONTRACTS[agent.specialistRole].title,
      specialty: agent.specialty,
      operatorContext,
      github: workspaceAwareness.github
    });
  }

  try {
    const response = await client.responses.create({
      model: openaiConfig.model,
      input: [
        {
          role: "system",
          content: buildAgentSystemPrompt(agent, workspaceAwareness)
        },
        {
          role: "user",
          content: `[Conversation Transcript]\n${buildTranscript(agent, messages)}\n\n[Latest Operator Intent]\n${operatorContext}`
        }
      ]
    });

    const reply = response.output_text.trim();
    if (!reply) {
      throw new Error("Empty response");
    }

    return {
      reply,
      readyToExecute: false,
      draftId: null
    };
  } catch {
    return buildFallbackAgentTurn({
      agentName: agent.name,
      agentTitle: AGENT_CONTRACTS[agent.specialistRole].title,
      specialty: agent.specialty,
      operatorContext,
      github: workspaceAwareness.github
    });
  }
}

function mapAgentMessagesToPmMessages(messages: AgentConversationMessage[]): PmConversationMessage[] {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "pm" : message.role,
    content: message.content
  }));
}

export async function createAgentConversationTurn(
  workspaceId: string,
  agentId: string,
  messages: AgentConversationMessage[]
): Promise<AgentConversationTurn> {
  const validatedMessages = z.array(agentConversationMessageSchema).min(1).max(24).parse(messages);
  const agent = await loadWorkspaceAgent(workspaceId, agentId);

  if (agent.specialistRole === "PROJECT_MANAGER") {
    return createPmConversationTurn(workspaceId, mapAgentMessagesToPmMessages(validatedMessages));
  }

  return runSpecialistConversationTurn(workspaceId, agent, validatedMessages);
}
