"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type {
  AgentChatFinalMessage,
  AgentChatStreamEvent,
  WorkspaceActionType,
  WorkspaceSceneAgent
} from "@second-space/shared-types";
import { usePresentationScene } from "@/lib/presentation/use-presentation-scene";
import AgentConversationPanel, { type MissionChatMessage } from "./AgentConversationPanel";
import MissionStage from "./MissionStage";

interface PendingMissionExecution {
  draftId: string;
}

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
}

interface IntegrationRecord {
  id: string;
  provider: "GITHUB" | "LINKEDIN" | "GMAIL";
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  tokenMetadata?: Record<string, unknown> | null;
}

interface MissionControlScreenProps {
  onOpenSettings: (target: "integrations" | "knowledge") => void;
}

function newMissionMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `mission-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildAgentOpeningMessage(agent: WorkspaceSceneAgent): string {
  if (agent.specialistRole === "PROJECT_MANAGER") {
    return "Tell me what you want to get done. I’ll help shape it, ask for the minimum context I need, and when it’s ready you can tell me to go.";
  }

  return `You’re talking to ${agent.name}. Ask me anything related to ${agent.specialty}, and I’ll respond directly from my role.`;
}

function parseStreamBlocks(chunk: string, carry: string): { blocks: string[]; carry: string } {
  const buffer = carry + chunk;
  const blocks = buffer.split("\n\n");
  const nextCarry = blocks.pop() ?? "";
  return {
    blocks,
    carry: nextCarry
  };
}

function parseStreamEvent(block: string): AgentChatStreamEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLine = lines.find((line) => line.startsWith("data:"));
  if (!dataLine) {
    return null;
  }

  return JSON.parse(dataLine.slice(5).trim()) as AgentChatStreamEvent;
}

export default function MissionControlScreen({ onOpenSettings }: MissionControlScreenProps) {
  const { scene, selectedAgentId, setSelectedAgentId, refresh, loading, error: sceneError } = usePresentationScene({
    include: ["feed", "integrations", "approvals", "holds"],
    channel: "dashboard"
  });
  const [commandInput, setCommandInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [agentConversations, setAgentConversations] = useState<Record<string, MissionChatMessage[]>>({});
  const [pendingExecutions, setPendingExecutions] = useState<Record<string, PendingMissionExecution | undefined>>({});
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [repoBindingOpen, setRepoBindingOpen] = useState(false);
  const [selectedGithubRepoFullName, setSelectedGithubRepoFullName] = useState("");
  const [githubIntegrationId, setGithubIntegrationId] = useState<string | null>(null);
  const [knowledgeTrayMode, setKnowledgeTrayMode] = useState<"file" | "note" | null>(null);
  const [knowledgeTitle, setKnowledgeTitle] = useState("Workspace note");
  const [knowledgeContent, setKnowledgeContent] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const missionChatWindowRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const agents = scene?.agents ?? [];
  const selectedAgent = useMemo(() => agents.find((agent) => agent.id === selectedAgentId) ?? null, [agents, selectedAgentId]);
  const messages = useMemo(() => (selectedAgentId ? agentConversations[selectedAgentId] ?? [] : []), [agentConversations, selectedAgentId]);
  const pendingExecution = useMemo(() => (selectedAgentId ? pendingExecutions[selectedAgentId] ?? null : null), [pendingExecutions, selectedAgentId]);

  useEffect(() => {
    if (!scene || selectedAgentId) {
      return;
    }

    const defaultAgent = scene.agents.find((agent) => agent.specialistRole === "PROJECT_MANAGER") ?? scene.agents[0] ?? null;
    if (defaultAgent) {
      setSelectedAgentId(defaultAgent.id);
    }
  }, [scene, selectedAgentId, setSelectedAgentId]);

  useEffect(() => {
    if (!selectedAgent) {
      return;
    }

    setAgentConversations((current) => {
      if (current[selectedAgent.id]?.length) {
        return current;
      }

      return {
        ...current,
        [selectedAgent.id]: [
          {
            id: newMissionMessageId(),
            role: "assistant",
            content: buildAgentOpeningMessage(selectedAgent),
            createdAt: new Date().toISOString(),
            actionHints: []
          }
        ]
      };
    });
  }, [selectedAgent]);

  useEffect(() => {
    if (!missionChatWindowRef.current) {
      return;
    }

    missionChatWindowRef.current.scrollTop = missionChatWindowRef.current.scrollHeight;
  }, [messages, pendingExecution, repoBindingOpen, knowledgeTrayMode]);

  function appendAgentMessage(agentId: string, message: MissionChatMessage) {
    setAgentConversations((current) => ({
      ...current,
      [agentId]: [...(current[agentId] ?? []), message]
    }));
  }

  function patchAgentMessage(agentId: string, messageId: string, updater: (message: MissionChatMessage) => MissionChatMessage) {
    setAgentConversations((current) => ({
      ...current,
      [agentId]: (current[agentId] ?? []).map((message) => (message.id === messageId ? updater(message) : message))
    }));
  }

  async function loadGithubIntegration(): Promise<IntegrationRecord | null> {
    const response = await fetch("/api/integrations");
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not load integrations");
    }

    return ((payload.integrations ?? []) as IntegrationRecord[]).find((integration) => integration.provider === "GITHUB") ?? null;
  }

  async function openRepoBinder() {
    const githubIntegration = await loadGithubIntegration();
    if (!githubIntegration || githubIntegration.authStatus !== "CONNECTED") {
      throw new Error("GitHub must be connected before you can bind a repository.");
    }

    const response = await fetch(`/api/integrations/${githubIntegration.id}/github/repos`);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not load GitHub repos");
    }

    const currentOwner = typeof githubIntegration.tokenMetadata?.repoOwner === "string" ? githubIntegration.tokenMetadata.repoOwner : "";
    const currentRepo = typeof githubIntegration.tokenMetadata?.repoName === "string" ? githubIntegration.tokenMetadata.repoName : "";

    setGithubIntegrationId(githubIntegration.id);
    setGithubRepos(payload.repos ?? []);
    setSelectedGithubRepoFullName(currentOwner && currentRepo ? `${currentOwner}/${currentRepo}` : payload.repos?.[0]?.fullName ?? "");
    setRepoBindingOpen(true);
  }

  async function connectGitHub() {
    const response = await fetch("/api/integrations/github/connect", {
      method: "POST"
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Could not initialize GitHub connect");
    }

    if (payload.mode === "oauth" && payload.authUrl) {
      window.location.href = payload.authUrl;
      return;
    }

    throw new Error(payload.message ?? "GitHub OAuth is not fully configured in this environment.");
  }

  async function saveRepoBinding() {
    if (!githubIntegrationId || !selectedGithubRepoFullName) {
      return;
    }

    const [repoOwner, repoName] = selectedGithubRepoFullName.split("/");
    const selectedRepo = githubRepos.find((repo) => repo.fullName === selectedGithubRepoFullName);
    const response = await fetch(`/api/integrations/${githubIntegrationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        repoOwner,
        repoName,
        defaultBranch: selectedRepo?.defaultBranch ?? "main"
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not save repository binding");
    }

    setRepoBindingOpen(false);
    await refresh(selectedAgentId);
  }

  async function handleKnowledgeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !selectedAgentId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/knowledge/files", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not upload file to workspace knowledge");
      }

      appendAgentMessage(selectedAgentId, {
        id: newMissionMessageId(),
        role: "system",
        content: `Uploaded ${file.name} to workspace knowledge. Ask the agent to use it in the next message.`,
        createdAt: new Date().toISOString(),
        actionHints: []
      });
      setKnowledgeTrayMode(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload file to workspace knowledge");
    } finally {
      if (event.target) {
        event.target.value = "";
      }
      setBusy(false);
    }
  }

  async function saveKnowledgeNote() {
    if (!knowledgeContent.trim() || !selectedAgentId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/knowledge/note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: knowledgeTitle.trim(),
          content: knowledgeContent.trim()
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save workspace note");
      }

      appendAgentMessage(selectedAgentId, {
        id: newMissionMessageId(),
        role: "system",
        content: `Saved \"${knowledgeTitle.trim()}\" into workspace knowledge. You can reference it in the chat now.`,
        createdAt: new Date().toISOString(),
        actionHints: []
      });
      setKnowledgeContent("");
      setKnowledgeTrayMode(null);
    } catch (noteError) {
      setError(noteError instanceof Error ? noteError.message : "Could not save workspace note");
    } finally {
      setBusy(false);
    }
  }

  async function handleActionHint(type: WorkspaceActionType) {
    setError(null);

    try {
      switch (type) {
        case "CONNECT_GITHUB":
          onOpenSettings("integrations");
          return;
        case "BIND_GITHUB_REPO":
          onOpenSettings("integrations");
          return;
        case "OPEN_INTEGRATIONS":
          onOpenSettings("integrations");
          return;
        case "UPLOAD_SOURCE_FILES":
          onOpenSettings("knowledge");
          return;
        case "OPEN_KNOWLEDGE_PANEL":
          onOpenSettings("knowledge");
          return;
        default:
          return;
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not complete that action");
    }
  }

  async function requestAgentTurnFallback(agentId: string, requestMessages: MissionChatMessage[], placeholderId: string) {
    const response = await fetch("/api/agent-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        agentId,
        messages: requestMessages.map((message) => ({
          role: message.role,
          content: message.content
        }))
      })
    });
    const payload = (await response.json()) as AgentChatFinalMessage & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to get agent reply");
    }

    patchAgentMessage(agentId, placeholderId, (message) => ({
      ...message,
      content: payload.reply,
      actionHints: payload.actionHints ?? [],
      streaming: false
    }));
    setPendingExecutions((current) => ({
      ...current,
      [agentId]: payload.readyToExecute && payload.draftId ? { draftId: String(payload.draftId) } : undefined
    }));
  }

  async function submitCommand() {
    if (!selectedAgentId || !selectedAgent || !commandInput.trim()) {
      return;
    }

    const agentId = selectedAgentId;
    const operatorMessage: MissionChatMessage = {
      id: newMissionMessageId(),
      role: "operator",
      content: commandInput.trim(),
      createdAt: new Date().toISOString(),
      actionHints: []
    };
    const placeholderId = newMissionMessageId();
    const placeholder: MissionChatMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      actionHints: [],
      streaming: true
    };
    const requestMessages = [...(agentConversations[agentId] ?? []), operatorMessage].slice(-24);

    setAgentConversations((current) => ({
      ...current,
      [agentId]: [...(current[agentId] ?? []), operatorMessage, placeholder]
    }));
    setPendingExecutions((current) => ({
      ...current,
      [agentId]: undefined
    }));
    setBusy(true);
    setError(null);
    setCommandInput("");

    try {
      const response = await fetch("/api/agent-chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          messages: requestMessages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });

      if (!response.ok || !response.body) {
        await requestAgentTurnFallback(agentId, requestMessages, placeholderId);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let carry = "";
      let finalized = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const parsed = parseStreamBlocks(decoder.decode(value, { stream: true }), carry);
        carry = parsed.carry;

        for (const block of parsed.blocks) {
          const streamEvent = parseStreamEvent(block);
          if (!streamEvent) {
            continue;
          }

          if (streamEvent.type === "token") {
            patchAgentMessage(agentId, placeholderId, (message) => ({
              ...message,
              content: `${message.content}${streamEvent.token}`,
              streaming: true
            }));
            continue;
          }

          if (streamEvent.type === "final") {
            finalized = true;
            patchAgentMessage(agentId, placeholderId, (message) => ({
              ...message,
              content: streamEvent.message.reply,
              actionHints: streamEvent.message.actionHints,
              streaming: false
            }));
            setPendingExecutions((current) => ({
              ...current,
              [agentId]: streamEvent.message.readyToExecute && streamEvent.message.draftId ? { draftId: String(streamEvent.message.draftId) } : undefined
            }));
            break;
          }

          if (streamEvent.type === "error") {
            throw new Error(streamEvent.error);
          }
        }
      }

      if (!finalized) {
        await requestAgentTurnFallback(agentId, requestMessages, placeholderId);
      }
    } catch (submitError) {
      patchAgentMessage(agentId, placeholderId, (message) => ({
        ...message,
        content: submitError instanceof Error ? `Could not process that request: ${submitError.message}` : "Could not process that request.",
        actionHints: [],
        streaming: false,
        role: "system"
      }));
      setError(submitError instanceof Error ? submitError.message : "Failed to get agent reply");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!selectedAgentId || !pendingExecution) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/commands/${pendingExecution.draftId}/confirm`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to confirm draft");
      }

      const launched = Array.isArray(payload.tasks) ? payload.tasks.length : 0;
      appendAgentMessage(selectedAgentId, {
        id: newMissionMessageId(),
        role: "assistant",
        content:
          launched > 0
            ? `I’m starting now. I’ve opened ${launched} task${launched === 1 ? "" : "s"} and delegated the first wave of work to the team.`
            : "I’m on it. I’ve started the internal PM workflow and I’ll keep updating you here.",
        createdAt: new Date().toISOString(),
        actionHints: []
      });

      setPendingExecutions((current) => ({
        ...current,
        [selectedAgentId]: undefined
      }));
      await refresh(selectedAgentId);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm draft");
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        void (async () => {
          try {
            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            stream.getTracks().forEach((track) => track.stop());
            if (!blob.size) {
              return;
            }

            const formData = new FormData();
            formData.append("audio", blob, "voice.webm");
            const response = await fetch("/api/voice/transcribe", {
              method: "POST",
              body: formData
            });
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(payload.error ?? "Transcription failed");
            }

            if (payload.text) {
              setCommandInput((current) => (current ? `${current} ${payload.text}` : payload.text));
            }
          } catch (recordError) {
            setError(recordError instanceof Error ? recordError.message : "Transcription failed");
          }
        })();
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Voice capture failed");
      setIsRecording(false);
    }
  }

  const repoBindingSlot: ReactNode = repoBindingOpen ? (
    <div className="mission-inline-card">
      <div className="mission-inline-card-header">
        <strong>Bind GitHub Repository</strong>
        <button className="btn ghost" onClick={() => setRepoBindingOpen(false)} type="button">
          Close
        </button>
      </div>
      <div className="panel-row wrap">
        <select className="select" value={selectedGithubRepoFullName} onChange={(event) => setSelectedGithubRepoFullName(event.target.value)}>
          <option value="">Select a repository</option>
          {githubRepos.map((repo) => (
            <option key={repo.id} value={repo.fullName}>
              {repo.fullName}
            </option>
          ))}
        </select>
        <button className="btn btn-accent" disabled={busy || !selectedGithubRepoFullName} onClick={() => void saveRepoBinding()} type="button">
          Save Repo
        </button>
      </div>
    </div>
  ) : null;

  const knowledgeTraySlot: ReactNode = knowledgeTrayMode ? (
    <div className="mission-inline-card">
      <div className="mission-inline-card-header">
        <strong>{knowledgeTrayMode === "file" ? "Upload Source Files" : "Add Workspace Note"}</strong>
        <button className="btn ghost" onClick={() => setKnowledgeTrayMode(null)} type="button">
          Close
        </button>
      </div>
      {knowledgeTrayMode === "file" ? (
        <div className="panel-row wrap">
          <input ref={fileInputRef} className="input" onChange={handleKnowledgeFile} type="file" />
        </div>
      ) : (
        <div className="mission-knowledge-form">
          <input className="input" value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} />
          <textarea
            className="textarea"
            placeholder="Paste reference material or constraints here..."
            value={knowledgeContent}
            onChange={(event) => setKnowledgeContent(event.target.value)}
          />
          <div className="panel-row wrap">
            <button className="btn btn-accent" disabled={busy || !knowledgeContent.trim()} onClick={() => void saveKnowledgeNote()} type="button">
              Save Note
            </button>
          </div>
        </div>
      )}
    </div>
  ) : (
    <input ref={fileInputRef} className="visually-hidden" onChange={handleKnowledgeFile} type="file" />
  );

  return (
    <section className="screen-grid mission-grid mission-grid-fixed">
      <MissionStage scene={scene} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />

      <div className="mission-right-column">
        <AgentConversationPanel
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          selectedAgent={selectedAgent}
          selectedSceneAgent={scene?.selectedAgent ?? null}
          messages={messages}
          busy={busy || loading}
          isRecording={isRecording}
          commandInput={commandInput}
          onCommandInputChange={setCommandInput}
          onSend={() => void submitCommand()}
          onGo={() => void confirmDraft()}
          onToggleRecording={() => void toggleRecording()}
          onActionHint={(type) => void handleActionHint(type)}
          canExecute={Boolean(selectedAgent?.specialistRole === "PROJECT_MANAGER" && pendingExecution)}
          error={error ?? sceneError}
          chatWindowRef={missionChatWindowRef}
          repoBindingSlot={repoBindingSlot}
          knowledgeTraySlot={knowledgeTraySlot}
        />
      </div>
    </section>
  );
}
