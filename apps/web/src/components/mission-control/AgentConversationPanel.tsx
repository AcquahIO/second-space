"use client";

import { useMemo, type ReactNode, type RefObject } from "react";
import type { WorkspaceActionHint, WorkspaceActionType, WorkspaceSceneAgent, WorkspaceSceneSelectedAgent } from "@second-space/shared-types";
import WorkspaceActionHintBar from "./WorkspaceActionHintBar";

export interface MissionChatMessage {
  id: string;
  role: "operator" | "assistant" | "system";
  content: string;
  createdAt: string;
  actionHints: WorkspaceActionHint[];
  streaming?: boolean;
}

interface AgentConversationPanelProps {
  agents: WorkspaceSceneAgent[];
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  selectedAgent: WorkspaceSceneAgent | null;
  selectedSceneAgent: WorkspaceSceneSelectedAgent | null;
  messages: MissionChatMessage[];
  busy: boolean;
  isRecording: boolean;
  commandInput: string;
  onCommandInputChange: (value: string) => void;
  onSend: () => void;
  onGo: () => void;
  onToggleRecording: () => void;
  onActionHint: (type: WorkspaceActionType) => void;
  canExecute: boolean;
  error: string | null;
  chatWindowRef: RefObject<HTMLDivElement>;
  repoBindingSlot?: ReactNode;
  knowledgeTraySlot?: ReactNode;
}

export default function AgentConversationPanel({
  agents,
  selectedAgentId,
  onSelectAgent,
  selectedAgent,
  selectedSceneAgent,
  messages,
  busy,
  isRecording,
  commandInput,
  onCommandInputChange,
  onSend,
  onGo,
  onToggleRecording,
  onActionHint,
  canExecute,
  error,
  chatWindowRef,
  repoBindingSlot,
  knowledgeTraySlot
}: AgentConversationPanelProps) {
  const subtitle = useMemo(() => {
    if (!selectedAgent) {
      return "Choose an agent, then chat naturally.";
    }

    const roleHint =
      selectedAgent.specialistRole === "PROJECT_MANAGER"
        ? "When PM has enough context, Go will appear here."
        : "Use PM for cross-team execution and orchestration.";

    return `${selectedSceneAgent?.summary ?? selectedAgent.specialty}. ${roleHint}`;
  }, [selectedAgent, selectedSceneAgent]);

  return (
    <div className="panel-section agent-chat-shell">
      <div className="agent-chat-topbar">
        <div className="agent-chat-topline">
          <span className="agent-chat-eyebrow">Active Agent</span>
          <div className="agent-chat-selector-wrap">
            <select
              className="select agent-chat-selector"
              value={selectedAgentId ?? ""}
              onChange={(event) => onSelectAgent(event.target.value || null)}
            >
              <option value="">Select an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} · {agent.specialistRole.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="agent-chat-heading-row">
          <div>
            <h2>{selectedAgent ? `Talk to ${selectedAgent.name}` : "Talk to an Agent"}</h2>
            <p className="agent-chat-subtitle">{subtitle}</p>
          </div>
          {selectedSceneAgent ? (
            <div className="agent-chat-kpis">
              <span>Zone {selectedSceneAgent.zone}</span>
              <span>{selectedSceneAgent.currentTaskCount} active tasks</span>
              <span>{selectedSceneAgent.blockedTaskCount} blocked</span>
            </div>
          ) : null}
        </div>
        {selectedSceneAgent?.latestFeedMessage ? <div className="agent-chat-scene-note">{selectedSceneAgent.latestFeedMessage}</div> : null}
        {error ? <div className="agent-chat-error-note">{error}</div> : null}
      </div>

      <div className="agent-chat-window" ref={chatWindowRef}>
        {selectedAgent ? (
          messages.length ? (
            messages.map((message) => (
              <div className={`agent-chat-message ${message.role}`} key={message.id}>
                <div className="agent-chat-message-label">
                  {message.role === "operator" ? "You" : message.role === "assistant" ? selectedAgent.name : "System"}
                </div>
                <div className="agent-chat-message-body">{message.content || (message.streaming ? "…" : "")}</div>
                {message.role === "assistant" && message.actionHints.length ? (
                  <WorkspaceActionHintBar hints={message.actionHints} disabled={busy} onAction={onActionHint} />
                ) : null}
              </div>
            ))
          ) : (
            <div className="agent-chat-empty">Start the conversation here.</div>
          )
        ) : (
          <div className="agent-chat-empty">Select an agent to start chatting.</div>
        )}
      </div>

      <div className="agent-chat-composer-shell">
        {canExecute ? (
          <div className="agent-chat-ready-banner">
            <span>PM has enough context. Press Go to start the mission.</span>
            <button className="btn btn-go" disabled={busy} onClick={onGo} type="button">
              Go
            </button>
          </div>
        ) : null}

        {repoBindingSlot}
        {knowledgeTraySlot}

        <div className="agent-chat-composer">
          <textarea
            className="textarea agent-chat-input"
            disabled={!selectedAgent || busy}
            placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Select an agent first"}
            value={commandInput}
            onChange={(event) => onCommandInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!busy) {
                  onSend();
                }
              }
            }}
          />
          <div className="agent-chat-toolbar">
            <button className={`btn ${isRecording ? "btn-danger" : "btn-warn"}`} onClick={onToggleRecording} type="button">
              {isRecording ? "Stop Voice" : "Voice"}
            </button>
            <button className="btn btn-accent" disabled={busy || !selectedAgent} onClick={onSend} type="button">
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
