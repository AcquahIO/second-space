import { buildGithubAccessGuidance, type GithubWorkspaceContext } from "./access-guidance";

interface FallbackAgentTurnInput {
  agentName: string;
  agentTitle: string;
  specialty: string;
  operatorContext: string;
  github?: GithubWorkspaceContext | null;
}

export interface FallbackAgentTurn {
  reply: string;
  readyToExecute: boolean;
  draftId: string | null;
}

function looksBroadlyCoordinatedRequest(operatorContext: string): boolean {
  return /\b(team|everyone|agents|ship|launch|coordinate|delegate|roll out|entire)\b/i.test(operatorContext);
}

export function buildFallbackAgentTurn(input: FallbackAgentTurnInput): FallbackAgentTurn {
  const { agentName, agentTitle, specialty, operatorContext } = input;
  const trimmed = operatorContext.trim();
  const githubGuidance = buildGithubAccessGuidance(trimmed, input.github ?? null);

  if (githubGuidance) {
    return {
      reply: githubGuidance,
      readyToExecute: false,
      draftId: null
    };
  }

  if (!trimmed) {
    return {
      reply: `I’m ${agentName}, your ${agentTitle.toLowerCase()}. Tell me what you need help with on the ${specialty.toLowerCase()} side and I’ll respond directly.`,
      readyToExecute: false,
      draftId: null
    };
  }

  if (looksBroadlyCoordinatedRequest(trimmed)) {
    return {
      reply: `I can help from the ${specialty.toLowerCase()} side. If you want cross-team coordination or execution, send that through the PM. If you want my direct view, tell me the specific problem, constraints, and what outcome matters most.`,
      readyToExecute: false,
      draftId: null
    };
  }

  return {
    reply: `From the ${specialty.toLowerCase()} side, I’d approach it by clarifying the target outcome, the key constraint, and the biggest risk first. If you give me those three things, I can give you a concrete answer.`,
    readyToExecute: false,
    draftId: null
  };
}
