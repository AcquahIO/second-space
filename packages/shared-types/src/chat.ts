export const WORKSPACE_ACTION_TYPES = [
  "CONNECT_GITHUB",
  "BIND_GITHUB_REPO",
  "OPEN_INTEGRATIONS",
  "UPLOAD_SOURCE_FILES",
  "OPEN_KNOWLEDGE_PANEL"
] as const;

export type WorkspaceActionType = (typeof WORKSPACE_ACTION_TYPES)[number];

export interface WorkspaceActionHint {
  type: WorkspaceActionType;
  label: string;
  description: string;
}

export interface AgentChatFinalMessage {
  reply: string;
  readyToExecute: boolean;
  draftId: string | null;
  actionHints: WorkspaceActionHint[];
}

export type AgentChatStreamEvent =
  | {
      type: "token";
      token: string;
    }
  | {
      type: "final";
      message: AgentChatFinalMessage;
    }
  | {
      type: "error";
      error: string;
    };
