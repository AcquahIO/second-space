"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceSceneResponse } from "@second-space/shared-types";
import OfficeSim from "@/components/OfficeSim";
import { buildSceneSummary, resolveSceneZone } from "@/lib/presentation/workspace-scene-helpers";

interface Session {
  sub: string;
  email: string;
  role: string;
  exp: number;
}

type Role = "DIRECTOR" | "MANAGER" | "SPECIALIST";
type AgentState = "IDLE" | "MOVING" | "WORKING" | "MEETING" | "BLOCKED";
type Mood = "FOCUSED" | "NEUTRAL" | "STRESSED";
type TabId = "MISSION_CONTROL" | "KANBAN" | "TASKS" | "CHAT" | "ORG" | "MEMORY" | "GOVERNANCE";

interface Agent {
  id: string;
  name: string;
  role: Role;
  specialistRole?: string;
  specialty: string;
  state: AgentState;
  manager?: {
    id: string;
    name: string;
  } | null;
  stats?: {
    xp: number;
    level: number;
    mood: Mood;
    badges: string[];
    streak: number;
  } | null;
  simPosition?: {
    x: number;
    y: number;
  } | null;
  tools?: {
    tool: {
      id: string;
      name: string;
      provider: string;
      executionMode: "REAL" | "MOCK";
    };
  }[];
}

interface Approval {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
}

interface TaskEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string;
  assignee: {
    id: string;
    name: string;
    role: string;
  };
  createdBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  requiresApproval: boolean;
  metadata?: unknown;
  events?: TaskEvent[];
  approvals: Approval[];
}

interface FeedItem {
  id: string;
  message: string;
  category: "TASK" | "APPROVAL" | "SIM" | "SYSTEM";
  createdAt: string;
}

interface PendingMissionExecution {
  draftId: string;
}

interface MissionChatMessage {
  id: string;
  role: "operator" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface IntegrationPermission {
  id: string;
  agentId: string;
  capabilities: Array<"READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH">;
}

interface IntegrationRecord {
  id: string;
  provider: "GITHUB" | "LINKEDIN" | "GMAIL";
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  accountLabel?: string | null;
  capabilities: Array<"READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH">;
  tokenMetadata?: Record<string, unknown> | null;
  agentPermissions?: IntegrationPermission[];
}

interface SecurityHold {
  id: string;
  scope: "TASK" | "WORKSPACE";
  status: "ACTIVE" | "RELEASED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reason: string;
  taskId?: string | null;
  createdAt: string;
}

interface UserContextItem {
  id: string;
  type: "GOAL" | "PREFERENCE" | "STRENGTH" | "WEAKNESS" | "BUSINESS_CONTEXT" | "PRODUCT_CONTEXT" | "WORKING_STYLE";
  title: string;
  content: string;
  weight: number;
}

interface LearningProposal {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  title: string;
  rationale: string;
  createdAt: string;
  agent?: {
    id: string;
    name: string;
    specialistRole: string;
  } | null;
}

interface ReflectionRun {
  id: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  summary: string;
  analyzedEventCount: number;
  createdAt: string;
  agent?: {
    id: string;
    name: string;
    specialistRole: string;
  } | null;
}

interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  senderAgentId?: string | null;
  senderName?: string | null;
  recipientAgentId?: string | null;
  recipientName?: string | null;
}

interface ChatThread {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  latestMessageAt: string;
  assignee: {
    id: string;
    name: string;
    role: string;
  };
  messages: ChatMessage[];
}

interface AgentMemory {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface AgentMemoryGroup {
  id: string;
  name: string;
  role: Role;
  memories: AgentMemory[];
}

interface SceneIntegrationStatus {
  provider: "GITHUB" | "LINKEDIN" | "GMAIL";
  authStatus: "DISCONNECTED" | "CONNECTED" | "ERROR";
  connected: boolean;
  accountLabel: string | null;
  repoFullName: string | null;
  defaultBranch: string | null;
}

function isFeedItemPayload(payload: unknown): payload is FeedItem {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const maybeFeed = payload as Partial<FeedItem>;

  return (
    typeof maybeFeed.id === "string" &&
    typeof maybeFeed.message === "string" &&
    typeof maybeFeed.category === "string" &&
    typeof maybeFeed.createdAt === "string"
  );
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "MISSION_CONTROL", label: "Home" },
  { id: "KANBAN", label: "Kanban" },
  { id: "TASKS", label: "Tasks" },
  { id: "CHAT", label: "Chat" },
  { id: "ORG", label: "Org" },
  { id: "MEMORY", label: "Memory" },
  { id: "GOVERNANCE", label: "Settings" }
];

const KANBAN_COLUMNS = [
  {
    id: "BACKLOG",
    label: "Backlog",
    statuses: ["DRAFT", "QUEUED", "ASSIGNED"]
  },
  {
    id: "IN_PROGRESS",
    label: "In Progress",
    statuses: ["IN_PROGRESS", "BLOCKED"]
  },
  {
    id: "REVIEW",
    label: "Review",
    statuses: ["PENDING_APPROVAL"]
  },
  {
    id: "DONE",
    label: "Done",
    statuses: ["DONE", "FAILED", "CANCELLED"]
  }
] as const;

const CAPABILITY_OPTIONS = ["READ", "WRITE", "POST", "SEND", "COMMIT", "PUSH"] as const;

type KanbanColumnId = (typeof KANBAN_COLUMNS)[number]["id"];

function formatTaskStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getKanbanColumnId(status: string): KanbanColumnId {
  for (const column of KANBAN_COLUMNS) {
    if (column.statuses.some((columnStatus) => columnStatus === status)) {
      return column.id;
    }
  }

  return "BACKLOG";
}

function newMissionMessageId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `mission-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCriteriaValue(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(/\n|;|•/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    const nested = (value as { items?: unknown }).items;
    if (nested) {
      return normalizeCriteriaValue(nested);
    }
  }

  return [];
}

function getTaskCriteria(task: Task): string[] {
  const metadata = task.metadata;
  if (metadata && typeof metadata === "object") {
    const metadataRecord = metadata as Record<string, unknown>;
    const keys = ["keyCriteria", "acceptanceCriteria", "successCriteria", "definitionOfDone", "criteria"];

    for (const key of keys) {
      const criteria = normalizeCriteriaValue(metadataRecord[key]);
      if (criteria.length) {
        return criteria.slice(0, 5);
      }
    }
  }

  const descriptionCriteria = normalizeCriteriaValue(task.description);
  if (descriptionCriteria.length > 1) {
    return descriptionCriteria.slice(0, 4);
  }

  const sentenceCriteria = task.description
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);

  if (sentenceCriteria.length) {
    return sentenceCriteria.slice(0, 3);
  }

  if (task.requiresApproval) {
    return ["Requires operator approval before any external action."];
  }

  return ["Complete the requested deliverable with clear handoff notes."];
}

function buildAgentOpeningMessage(agent: Agent): string {
  if (agent.specialistRole === "PROJECT_MANAGER") {
    return "Tell me what you want to get done. I’ll help shape it, ask for the minimum context I need, and when it’s ready you can tell me to go.";
  }

  return `You’re talking to ${agent.name}. Ask me anything related to ${agent.specialty}, and I’ll respond directly from my role.`;
}

function dedupeMissionAgents(agents: Agent[]): Agent[] {
  const bySpecialistRole = new Map<string, Agent>();

  for (const agent of agents) {
    const key = agent.specialistRole ?? agent.id;
    const existing = bySpecialistRole.get(key);

    if (!existing) {
      bySpecialistRole.set(key, agent);
      continue;
    }

    const agentScore = Number(agent.id.includes("_"));
    const existingScore = Number(existing.id.includes("_"));

    if (agentScore > existingScore) {
      bySpecialistRole.set(key, agent);
    }
  }

  return Array.from(bySpecialistRole.values());
}

export default function Dashboard({ session }: { session: Session }) {
  const [activeTab, setActiveTab] = useState<TabId>("MISSION_CONTROL");
  const [showManual, setShowManual] = useState(false);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedKanbanTaskId, setSelectedKanbanTaskId] = useState<string | null>(null);

  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [selectedThreadTaskId, setSelectedThreadTaskId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");

  const [memoryGroups, setMemoryGroups] = useState<AgentMemoryGroup[]>([]);
  const [memoryDrafts, setMemoryDrafts] = useState<Record<string, string>>({});

  const [commandInput, setCommandInput] = useState("");
  const [agentConversations, setAgentConversations] = useState<Record<string, MissionChatMessage[]>>({});
  const [pendingExecutions, setPendingExecutions] = useState<Record<string, PendingMissionExecution | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [openAIKeyInput, setOpenAIKeyInput] = useState("");
  const [openAIModel, setOpenAIModel] = useState("gpt-4.1-mini");
  const [openAIConfigured, setOpenAIConfigured] = useState(false);

  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([]);
  const [selectedGithubRepoFullName, setSelectedGithubRepoFullName] = useState("");
  const [githubManualCode, setGithubManualCode] = useState("");
  const [integrationCapabilityDrafts, setIntegrationCapabilityDrafts] = useState<Record<string, Record<string, Array<"READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH">>>>({});

  const [securityHolds, setSecurityHolds] = useState<SecurityHold[]>([]);
  const [holdReason, setHoldReason] = useState("Potential policy risk detected");
  const [holdScope, setHoldScope] = useState<"TASK" | "WORKSPACE">("TASK");
  const [holdSeverity, setHoldSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("HIGH");

  const [userContexts, setUserContexts] = useState<UserContextItem[]>([]);
  const [userContextType, setUserContextType] = useState<UserContextItem["type"]>("GOAL");
  const [userContextTitle, setUserContextTitle] = useState("");
  const [userContextContent, setUserContextContent] = useState("");
  const [userContextWeight, setUserContextWeight] = useState(60);

  const [learningProposals, setLearningProposals] = useState<LearningProposal[]>([]);
  const [reflectionRuns, setReflectionRuns] = useState<ReflectionRun[]>([]);
  const [workspaceScene, setWorkspaceScene] = useState<WorkspaceSceneResponse | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const missionChatWindowRef = useRef<HTMLDivElement | null>(null);

  const missionAgents = useMemo(() => dedupeMissionAgents(agents), [agents]);
  const selectedAgent = useMemo(
    () => missionAgents.find((agent) => agent.id === selectedAgentId) ?? agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, missionAgents, selectedAgentId]
  );
  const activeMissionMessages = useMemo(
    () => (selectedAgentId ? agentConversations[selectedAgentId] ?? [] : []),
    [agentConversations, selectedAgentId]
  );
  const activePendingExecution = useMemo(
    () => (selectedAgentId ? pendingExecutions[selectedAgentId] ?? null : null),
    [pendingExecutions, selectedAgentId]
  );
  const githubIntegration = useMemo(
    () => integrations.find((integration) => integration.provider === "GITHUB") ?? null,
    [integrations]
  );

  const selectedThread = useMemo(() => {
    if (!chatThreads.length) {
      return null;
    }

    return chatThreads.find((thread) => thread.taskId === selectedThreadTaskId) ?? chatThreads[0];
  }, [chatThreads, selectedThreadTaskId]);

  const missionStageAgents = useMemo(
    () => workspaceScene?.agents ?? [],
    [workspaceScene]
  );

  const selectedSceneAgent = workspaceScene?.selectedAgent ?? null;
  const githubSceneIntegration = useMemo(
    () => (workspaceScene?.integrations?.items ?? []).find((integration) => integration.provider === "GITHUB") ?? null,
    [workspaceScene]
  );

  function describeGitHubReadiness(integration: SceneIntegrationStatus | null): string {
    if (!integration) {
      return "GitHub unknown";
    }

    if (integration.authStatus === "DISCONNECTED") {
      return "GitHub disconnected";
    }

    if (integration.authStatus === "ERROR") {
      return "GitHub error";
    }

    if (integration.repoFullName) {
      return `GitHub ${integration.repoFullName}`;
    }

    return "GitHub connected, repo not bound";
  }

  async function refreshScene(nextSelectedAgentId?: string | null) {
    const params = new URLSearchParams({
      view: "office",
      include: "feed,integrations,approvals,holds"
    });

    const targetSelectedAgentId = nextSelectedAgentId ?? selectedAgentId;
    if (targetSelectedAgentId) {
      params.set("selectedAgentId", targetSelectedAgentId);
    }

    const response = await fetch(`/api/presentation/workspace-scene?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load workspace scene");
    }

    setWorkspaceScene(payload);
    return payload as WorkspaceSceneResponse;
  }

  const pendingApprovals = useMemo(
    () => tasks.filter((task) => task.approvals?.some((approval) => approval.status === "PENDING")),
    [tasks]
  );

  const tasksByKanban = useMemo(() => {
    const grouped: Record<KanbanColumnId, Task[]> = {
      BACKLOG: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: []
    };

    for (const task of tasks) {
      grouped[getKanbanColumnId(task.status)].push(task);
    }

    for (const column of KANBAN_COLUMNS) {
      grouped[column.id].sort((left, right) => Number(new Date(right.updatedAt ?? right.createdAt)) - Number(new Date(left.updatedAt ?? left.createdAt)));
    }

    return grouped;
  }, [tasks]);

  const selectedKanbanTask = useMemo(() => {
    if (!tasks.length) {
      return null;
    }

    return tasks.find((task) => task.id === selectedKanbanTaskId) ?? tasks[0];
  }, [tasks, selectedKanbanTaskId]);

  const selectedKanbanCriteria = useMemo(() => {
    if (!selectedKanbanTask) {
      return [];
    }

    return getTaskCriteria(selectedKanbanTask);
  }, [selectedKanbanTask]);

  const agentsByRole = useMemo(() => {
    return {
      DIRECTOR: agents.filter((agent) => agent.role === "DIRECTOR"),
      MANAGER: agents.filter((agent) => agent.role === "MANAGER"),
      SPECIALIST: agents.filter((agent) => agent.role === "SPECIALIST")
    };
  }, [agents]);

  function appendAgentMessage(agentId: string, role: MissionChatMessage["role"], content: string) {
    setAgentConversations((current) => ({
      ...current,
      [agentId]: [
        ...(current[agentId] ?? []),
        {
          id: newMissionMessageId(),
          role,
          content,
          createdAt: new Date().toISOString()
        }
      ]
    }));
  }

  async function refreshAll() {
    const [agentsRes, tasksRes, feedRes, toolsRes, sceneRes, chatRes, memoryRes, integrationsRes, holdsRes, userContextRes, proposalsRes, reflectionsRes] =
      await Promise.all([
      fetch("/api/agents"),
      fetch("/api/tasks"),
      fetch("/api/feed"),
      fetch("/api/settings/tools"),
      fetch(
        `/api/presentation/workspace-scene?${new URLSearchParams({
          view: "office",
          include: "feed,integrations,approvals,holds",
          ...(selectedAgentId ? { selectedAgentId } : {})
        }).toString()}`
      ),
      fetch("/api/chat"),
      fetch("/api/memory"),
      fetch("/api/integrations"),
      fetch("/api/security/holds"),
      fetch("/api/user-context"),
      fetch("/api/learning/proposals"),
      fetch("/api/learning/reflections")
    ]);

    if (
      !agentsRes.ok ||
      !tasksRes.ok ||
      !feedRes.ok ||
      !toolsRes.ok ||
      !sceneRes.ok ||
      !chatRes.ok ||
      !memoryRes.ok ||
      !integrationsRes.ok ||
      !holdsRes.ok ||
      !userContextRes.ok ||
      !proposalsRes.ok ||
      !reflectionsRes.ok
    ) {
      throw new Error("Failed to load dashboard data");
    }

    const agentsData = await agentsRes.json();
    const tasksData = await tasksRes.json();
    const feedData = await feedRes.json();
    const toolsData = await toolsRes.json();
    const sceneData = (await sceneRes.json()) as WorkspaceSceneResponse;
    const chatData = await chatRes.json();
    const memoryData = await memoryRes.json();
    const integrationsData = await integrationsRes.json();
    const holdsData = await holdsRes.json();
    const userContextData = await userContextRes.json();
    const proposalsData = await proposalsRes.json();
    const reflectionsData = await reflectionsRes.json();

    const sceneAgentMap = new Map(
      (sceneData.agents ?? []).map((agent) => [
        agent.id,
        {
          state: agent.state,
          mood: agent.mood,
          simPosition: agent.simPosition
        }
      ])
    );

    const nextAgents = (agentsData.agents ?? []).map((agent: Agent) => ({
      ...agent,
      state: sceneAgentMap.get(agent.id)?.state ?? agent.state,
      stats:
        agent.stats && sceneAgentMap.get(agent.id)
          ? {
              ...agent.stats,
              mood: sceneAgentMap.get(agent.id)?.mood ?? agent.stats.mood
            }
          : agent.stats,
      simPosition: sceneAgentMap.get(agent.id)?.simPosition ?? agent.simPosition ?? { x: 100, y: 100 }
    }));

    const nextThreads: ChatThread[] = chatData.threads ?? [];
    const nextTasks: Task[] = tasksData.tasks ?? [];
    const nextMissionAgents = dedupeMissionAgents(nextAgents);

    setAgents(nextAgents);
    setTasks(nextTasks);
    setFeed(sceneData.feed ?? feedData.feed ?? []);
    setOpenAIModel(toolsData.openai?.model ?? "gpt-4.1-mini");
    setOpenAIConfigured(Boolean(toolsData.openai?.hasApiKey));
    setChatThreads(nextThreads);
    setMemoryGroups(memoryData.agents ?? []);
    setIntegrations(integrationsData.integrations ?? []);
    setSecurityHolds(holdsData.holds ?? []);
    setUserContexts(userContextData.contexts ?? []);
    setLearningProposals(proposalsData.proposals ?? []);
    setReflectionRuns(reflectionsData.runs ?? []);
    setWorkspaceScene(sceneData);

    const github = (integrationsData.integrations ?? []).find((integration: IntegrationRecord) => integration.provider === "GITHUB");
    const githubMeta =
      github && github.tokenMetadata && typeof github.tokenMetadata === "object"
        ? (github.tokenMetadata as Record<string, unknown>)
        : null;
    const repoOwner = typeof githubMeta?.repoOwner === "string" ? githubMeta.repoOwner : "";
    const repoName = typeof githubMeta?.repoName === "string" ? githubMeta.repoName : "";
    setSelectedGithubRepoFullName(repoOwner && repoName ? `${repoOwner}/${repoName}` : "");

    const capabilityDrafts: Record<string, Record<string, Array<"READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH">>> = {};
    for (const integration of integrationsData.integrations ?? []) {
      capabilityDrafts[integration.id] = {};
      for (const permission of integration.agentPermissions ?? []) {
        capabilityDrafts[integration.id][permission.agentId] = permission.capabilities ?? [];
      }
    }
    setIntegrationCapabilityDrafts(capabilityDrafts);

    setSelectedThreadTaskId((current) => {
      if (current && nextThreads.some((thread) => thread.taskId === current)) {
        return current;
      }
      return nextThreads[0]?.taskId ?? null;
    });

    setSelectedAgentId((current) => {
      if (current && nextMissionAgents.some((agent: Agent) => agent.id === current)) {
        return current;
      }

      const projectManager = nextMissionAgents.find((agent: Agent) => agent.specialistRole === "PROJECT_MANAGER");
      return projectManager?.id ?? nextMissionAgents[0]?.id ?? null;
    });

    setSelectedKanbanTaskId((current) => {
      if (current && nextTasks.some((task) => task.id === current)) {
        return current;
      }

      return nextTasks[0]?.id ?? null;
    });
  }

  useEffect(() => {
    void refreshAll().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load"));
  }, []);

  useEffect(() => {
    if (!selectedAgentId) {
      return;
    }

    void refreshScene(selectedAgentId).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load workspace scene"));
  }, [selectedAgentId]);

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
            createdAt: new Date().toISOString()
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
  }, [activeMissionMessages, activePendingExecution]);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4001";
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      if (closed) {
        return;
      }

      ws = new WebSocket(wsUrl);

      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data as string) as {
            type: string;
            payload: Record<string, unknown>;
          };

          if (event.type === "sim.agent.position.updated") {
            const agentId = String(event.payload.agentId);
            const x = Number(event.payload.x);
            const y = Number(event.payload.y);

            setAgents((current) =>
              current.map((agent) =>
                agent.id === agentId
                  ? {
                      ...agent,
                      simPosition: { x, y }
                    }
                  : agent
              )
            );
            setWorkspaceScene((current) => {
              if (!current) {
                return current;
              }

              return {
                ...current,
                agents: current.agents.map((agent) =>
                  agent.id === agentId ? { ...agent, simPosition: { x, y }, zone: resolveSceneZone(x, y) } : agent
                ),
                selectedAgent:
                  current.selectedAgent?.id === agentId
                    ? {
                        ...current.selectedAgent,
                        zone: resolveSceneZone(x, y)
                      }
                    : current.selectedAgent
              };
            });
            return;
          }

          if (event.type === "sim.agent.state.updated") {
            const agentId = String(event.payload.agentId);
            const state = String(event.payload.state) as Agent["state"];
            setAgents((current) => current.map((agent) => (agent.id === agentId ? { ...agent, state } : agent)));
            setWorkspaceScene((current) => {
              if (!current) {
                return current;
              }

              const nextAgents = current.agents.map((agent) => (agent.id === agentId ? { ...agent, state } : agent));

              return {
                ...current,
                agents: nextAgents,
                summary: buildSceneSummary(nextAgents, current.summary.approvalCount, current.summary.activeHoldCount),
                selectedAgent:
                  current.selectedAgent?.id === agentId
                    ? {
                        ...current.selectedAgent,
                        state
                      }
                    : current.selectedAgent
              };
            });
            return;
          }

          if (event.type === "feed.event") {
            const payload = event.payload;
            if (isFeedItemPayload(payload)) {
              setFeed((current) => [payload, ...current].slice(0, 120));
              setWorkspaceScene((current) =>
                current?.feed
                  ? {
                      ...current,
                      feed: (() => {
                        const sceneFeedItem: NonNullable<WorkspaceSceneResponse["feed"]>[number] = {
                          id: payload.id,
                          message: payload.message,
                          category: payload.category === "TASK" ? "TASK" : "SYSTEM",
                          createdAt: payload.createdAt
                        };

                        return [sceneFeedItem, ...current.feed].slice(0, 15);
                      })()
                    }
                  : current
              );
            }
          }

          if (
            [
              "task.created",
              "task.updated",
              "approval.requested",
              "approval.resolved",
              "security.hold.placed",
              "security.hold.released",
              "learning.proposal.created",
              "learning.proposal.resolved"
            ].includes(event.type)
          ) {
            void refreshAll();
          }
        } catch {
          // Ignore malformed realtime payloads.
        }
      };

      ws.onclose = () => {
        if (closed) {
          return;
        }
        reconnectTimer = setTimeout(connect, 1500);
      };

      ws.onerror = () => {
        // Connection failures are handled by onclose + reconnect scheduling.
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      ws?.close();
    };
  }, []);

  async function submitCommand() {
    if (!selectedAgentId || !commandInput.trim()) {
      return;
    }

    const agentId = selectedAgentId;
    const operatorText = commandInput.trim();
    const operatorMessage: MissionChatMessage = {
      id: newMissionMessageId(),
      role: "operator",
      content: operatorText,
      createdAt: new Date().toISOString()
    };
    const nextMissionMessages = [...(agentConversations[agentId] ?? []), operatorMessage];
    const requestMessages = nextMissionMessages.slice(-24);

    setAgentConversations((current) => ({
      ...current,
      [agentId]: nextMissionMessages
    }));
    setPendingExecutions((current) => ({
      ...current,
      [agentId]: undefined
    }));
    setBusy(true);
    setError(null);

    try {
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

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to get agent reply");
      }

      setPendingExecutions((current) => ({
        ...current,
        [agentId]: payload.readyToExecute && payload.draftId ? { draftId: String(payload.draftId) } : undefined
      }));
      appendAgentMessage(agentId, "assistant", String(payload.reply ?? "I’ve updated the mission context."));
      setCommandInput("");
    } catch (submitError) {
      appendAgentMessage(
        agentId,
        "system",
        submitError instanceof Error ? `Could not process that request: ${submitError.message}` : "Could not process that request."
      );
      setError(submitError instanceof Error ? submitError.message : "Failed to get agent reply");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDraft() {
    if (!selectedAgentId || !activePendingExecution) {
      return;
    }

    const agentId = selectedAgentId;
    const draftToConfirm = activePendingExecution;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/commands/${draftToConfirm.draftId}/confirm`, {
        method: "POST"
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to confirm draft");
      }

      const launched = Array.isArray(payload.tasks) ? payload.tasks.length : 0;
      if (launched > 0) {
        appendAgentMessage(
          agentId,
          "assistant",
          `I’m starting now. I’ve opened ${launched} task${launched === 1 ? "" : "s"} and delegated the first wave of work to the team.`
        );
      } else {
        appendAgentMessage(agentId, "assistant", "I’m on it. I’ve started the internal PM workflow and I’ll keep updating you here.");
      }

      setPendingExecutions((current) => ({
        ...current,
        [agentId]: undefined
      }));
      setCommandInput("");
      await refreshAll();
    } catch (confirmError) {
      appendAgentMessage(
        agentId,
        "system",
        confirmError instanceof Error ? `Execution failed: ${confirmError.message}` : "Execution failed."
      );
      setError(confirmError instanceof Error ? confirmError.message : "Failed to confirm draft");
    } finally {
      setBusy(false);
    }
  }

  async function approveTask(taskId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/approve`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Approval failed");
      }
      await refreshAll();
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function rejectTask(taskId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ reason: "Needs rework before external action" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Rejection failed");
      }
      await refreshAll();
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : "Rejection failed");
    } finally {
      setBusy(false);
    }
  }

  async function handoffTask(taskId: string, toAgentId: string) {
    if (!toAgentId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          toAgentId,
          reason: "Operator handoff to rebalance workload"
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Handoff failed");
      }
      await refreshAll();
    } catch (handoffError) {
      setError(handoffError instanceof Error ? handoffError.message : "Handoff failed");
    } finally {
      setBusy(false);
    }
  }

  function openTaskThread(taskId: string) {
    setSelectedThreadTaskId(taskId);
    setActiveTab("CHAT");
  }

  async function sendChatMessage() {
    if (!selectedThread || !chatInput.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          taskId: selectedThread.taskId,
          recipientAgentId: selectedThread.assignee.id,
          content: chatInput.trim()
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send message");
      }

      setChatInput("");
      await refreshAll();
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Could not send message");
    } finally {
      setBusy(false);
    }
  }

  async function saveMemory(agentId: string) {
    const content = memoryDrafts[agentId]?.trim() ?? "";
    if (!content) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          agentId,
          content
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save memory");
      }

      setMemoryDrafts((current) => ({
        ...current,
        [agentId]: ""
      }));

      await refreshAll();
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "Could not save memory");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMemory(memoryId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/memory/${memoryId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete memory");
      }

      await refreshAll();
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "Could not delete memory");
    } finally {
      setBusy(false);
    }
  }

  async function connectGitHub() {
    setBusy(true);
    setError(null);

    try {
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

      if (payload.mode === "manual") {
        setError("GitHub OAuth secret missing. Paste an access token/code in manual fallback below.");
      }
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Could not initialize GitHub connect");
    } finally {
      setBusy(false);
    }
  }

  async function submitGitHubManualCode() {
    if (!githubManualCode.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/github/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code: githubManualCode.trim(),
          accountLabel: "GitHub Workspace"
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Manual GitHub connect failed");
      }

      setGithubManualCode("");
      await refreshAll();
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : "Manual GitHub connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function fetchGithubRepos() {
    if (!githubIntegration) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/${githubIntegration.id}/github/repos`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load GitHub repos");
      }

      setGithubRepos(payload.repos ?? []);
    } catch (repoError) {
      setError(repoError instanceof Error ? repoError.message : "Could not load GitHub repos");
    } finally {
      setBusy(false);
    }
  }

  async function saveGitHubRepoBinding() {
    if (!githubIntegration || !selectedGithubRepoFullName) {
      return;
    }

    const [repoOwner, repoName] = selectedGithubRepoFullName.split("/");
    if (!repoOwner || !repoName) {
      return;
    }

    const selectedRepo = githubRepos.find((repo) => repo.fullName === selectedGithubRepoFullName);
    const defaultBranch = selectedRepo?.defaultBranch ?? "main";

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/${githubIntegration.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repoOwner,
          repoName,
          defaultBranch
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save repository binding");
      }

      await refreshAll();
    } catch (bindingError) {
      setError(bindingError instanceof Error ? bindingError.message : "Could not save repository binding");
    } finally {
      setBusy(false);
    }
  }

  function toggleIntegrationCapability(
    integrationId: string,
    agentId: string,
    capability: "READ" | "WRITE" | "POST" | "SEND" | "COMMIT" | "PUSH"
  ) {
    setIntegrationCapabilityDrafts((current) => {
      const currentByIntegration = current[integrationId] ?? {};
      const currentCaps = currentByIntegration[agentId] ?? [];
      const hasCapability = currentCaps.includes(capability);
      const nextCaps = hasCapability ? currentCaps.filter((entry) => entry !== capability) : [...currentCaps, capability];

      return {
        ...current,
        [integrationId]: {
          ...currentByIntegration,
          [agentId]: nextCaps
        }
      };
    });
  }

  async function saveIntegrationPermissions(integrationId: string) {
    const draft = integrationCapabilityDrafts[integrationId];
    if (!draft) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const permissions = Object.entries(draft).map(([agentId, capabilities]) => ({
        agentId,
        capabilities
      }));

      const response = await fetch(`/api/integrations/${integrationId}/agent-permissions`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          permissions
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save integration permissions");
      }

      await refreshAll();
    } catch (permissionsError) {
      setError(permissionsError instanceof Error ? permissionsError.message : "Could not save integration permissions");
    } finally {
      setBusy(false);
    }
  }

  async function createSecurityHold() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/security/holds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          scope: holdScope,
          severity: holdSeverity,
          reason: holdReason,
          taskId: holdScope === "TASK" ? selectedKanbanTask?.id ?? tasks[0]?.id : undefined
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create security hold");
      }

      await refreshAll();
    } catch (holdError) {
      setError(holdError instanceof Error ? holdError.message : "Could not create security hold");
    } finally {
      setBusy(false);
    }
  }

  async function releaseSecurityHold(holdId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/security/holds/${holdId}/release`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not release security hold");
      }

      await refreshAll();
    } catch (holdError) {
      setError(holdError instanceof Error ? holdError.message : "Could not release security hold");
    } finally {
      setBusy(false);
    }
  }

  async function addUserContext() {
    if (!userContextTitle.trim() || !userContextContent.trim()) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/user-context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: userContextType,
          title: userContextTitle.trim(),
          content: userContextContent.trim(),
          weight: userContextWeight
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not add user context");
      }

      setUserContextTitle("");
      setUserContextContent("");
      await refreshAll();
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : "Could not add user context");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUserContext(contextId: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/user-context/${contextId}`, {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not delete user context");
      }

      await refreshAll();
    } catch (contextError) {
      setError(contextError instanceof Error ? contextError.message : "Could not delete user context");
    } finally {
      setBusy(false);
    }
  }

  async function approveProposal(proposalId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/learning/proposals/${proposalId}/approve`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not approve proposal");
      }
      await refreshAll();
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : "Could not approve proposal");
    } finally {
      setBusy(false);
    }
  }

  async function rejectProposal(proposalId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/learning/proposals/${proposalId}/reject`, {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not reject proposal");
      }
      await refreshAll();
    } catch (proposalError) {
      setError(proposalError instanceof Error ? proposalError.message : "Could not reject proposal");
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
          } catch (transcriptionError) {
            setError(transcriptionError instanceof Error ? transcriptionError.message : "Transcription failed");
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

  async function saveOpenAISettings() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/tools/openai", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          apiKey: openAIKeyInput,
          model: openAIModel
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update settings");
      }

      setOpenAIConfigured(true);
      setOpenAIKeyInput("");
      await refreshAll();
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Failed to update settings");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <div className="dashboard-brand-row">
            <span className="dashboard-brand-mark" aria-hidden="true">
              🚀
            </span>
            <div>
              <p className="eyebrow">SECOND SPACE</p>
              <h1>Agents Workspace</h1>
            </div>
          </div>
          <p className="subtitle">{session.email}</p>
        </div>

        <nav className="menu-tabs" aria-label="Primary">
          <button className="workspace-selector" type="button">
            Agents Workspace
          </button>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`menu-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="btn" onClick={() => setShowManual((current) => !current)} type="button">
            {showManual ? "Hide Manual" : "Manual"}
          </button>
          <button className="btn" onClick={logout} type="button">
            Log out
          </button>
        </div>
      </header>

      {showManual ? (
        <section className="manual-strip">
          <div>
            <h2>Quick Operator Manual</h2>
            <p>1) Connect integrations and knowledge sources. 2) Launch command or scheduled missions. 3) Approve all write actions. 4) Tune behavior with memory notes.</p>
          </div>
          <div className="manual-points">
            <span>Mission Control: live office + command launch</span>
            <span>Kanban: ticket board, assignment details, and live activity lane</span>
            <span>Tasks: approvals and handoffs</span>
            <span>Chat: send instructions per task thread</span>
            <span>Org: specialist roster, tools, and profile stats</span>
            <span>Memory: persistent behavior notes per agent</span>
          </div>
        </section>
      ) : null}

      <main className="dashboard-main">
        {activeTab === "MISSION_CONTROL" ? (
          <section className="screen-grid mission-grid mission-grid-fixed">
            <div className="panel-section sim-panel mission-sim-panel">
              <div className="sim-caption">Minecraft-style Agent Office</div>
              <div className="sim-card">
                <OfficeSim agents={missionStageAgents} selectedAgentId={selectedAgentId} onSelectAgent={setSelectedAgentId} />
              </div>
              {workspaceScene ? (
                <div className="mission-scene-summary">
                  <span>{workspaceScene.summary.onlineAgents} agents live</span>
                  <span>{workspaceScene.summary.approvalCount} approvals</span>
                  <span>{workspaceScene.summary.activeHoldCount} holds</span>
                  <span>{describeGitHubReadiness(githubSceneIntegration)}</span>
                  {workspaceScene.workspace.blockedByWorkspaceHold ? <span>Workspace write-blocked</span> : null}
                </div>
              ) : null}
              <div className="agent-chip-row">
                {missionStageAgents.map((agent) => (
                  <button
                    className={`agent-chip ${selectedAgentId === agent.id ? "active" : ""}`}
                    key={agent.id}
                    onClick={() => setSelectedAgentId(agent.id)}
                    type="button"
                  >
                    {agent.name.split(" ")[0]} {agent.state}
                  </button>
                ))}
              </div>
              <div className="mission-stage-footer">Agent Floor</div>
            </div>

            <div className="mission-right-column">
              <div className="panel-section agent-chat-shell">
                <div className="agent-chat-topbar">
                  <div className="agent-chat-topline">
                    <span className="agent-chat-eyebrow">Active Agent</span>
                    <div className="agent-chat-selector-wrap">
                      <select
                        className="select agent-chat-selector"
                        value={selectedAgentId ?? ""}
                        onChange={(event) => setSelectedAgentId(event.target.value || null)}
                      >
                        {missionAgents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} · {agent.specialistRole?.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="agent-chat-heading-row">
                    <div>
                      <h2>{selectedAgent ? `Talk to ${selectedAgent.name}` : "Talk to an Agent"}</h2>
                      <p className="agent-chat-subtitle">
                        {selectedAgent
                          ? `${selectedSceneAgent?.summary ?? selectedAgent.specialty}. ${
                              selectedAgent.specialistRole === "PROJECT_MANAGER"
                                ? "When PM has enough context, Go will appear here."
                                : "Use PM for cross-team execution and orchestration."
                            }`
                          : "Choose an agent, then chat naturally."}
                      </p>
                    </div>
                    {selectedSceneAgent ? (
                      <div className="agent-chat-kpis">
                        <span>Zone {selectedSceneAgent.zone}</span>
                        <span>{selectedSceneAgent.currentTaskCount} active tasks</span>
                        <span>{selectedSceneAgent.blockedTaskCount} blocked</span>
                      </div>
                    ) : null}
                  </div>
                  {selectedSceneAgent?.latestFeedMessage ? (
                    <div className="agent-chat-scene-note">{selectedSceneAgent.latestFeedMessage}</div>
                  ) : null}
                </div>

                <div className="agent-chat-window" ref={missionChatWindowRef}>
                  {selectedAgent ? (
                    activeMissionMessages.map((message) => (
                      <div className={`agent-chat-message ${message.role}`} key={message.id}>
                        <div className="agent-chat-message-label">
                          {message.role === "operator" ? "You" : message.role === "assistant" ? selectedAgent.name : "System"}
                        </div>
                        <div className="agent-chat-message-body">{message.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="agent-chat-empty">Select an agent to start chatting.</div>
                  )}
                </div>

                <div className="agent-chat-composer-shell">
                  {selectedAgent?.specialistRole === "PROJECT_MANAGER" && activePendingExecution ? (
                    <div className="agent-chat-ready-banner">
                      <span>PM has enough context. Press Go to start the mission.</span>
                      <button className="btn btn-go" disabled={busy} onClick={confirmDraft} type="button">
                        Go
                      </button>
                    </div>
                  ) : null}

                  <div className="agent-chat-composer">
                    <textarea
                      className="textarea agent-chat-input"
                      disabled={!selectedAgent}
                      placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : "Select an agent first"}
                      value={commandInput}
                      onChange={(event) => setCommandInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          if (!busy) {
                            void submitCommand();
                          }
                        }
                      }}
                    />
                    <div className="agent-chat-toolbar">
                      <button className={`btn ${isRecording ? "btn-danger" : "btn-warn"}`} onClick={toggleRecording} type="button">
                        {isRecording ? "Stop Voice" : "Voice"}
                      </button>
                      <button className="btn btn-accent" disabled={busy || !selectedAgent} onClick={submitCommand} type="button">
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "KANBAN" ? (
          <section className="screen-grid kanban-grid">
            <div className="panel-section kanban-board-panel">
              <h2>Kanban Board</h2>
              <div className="kanban-board">
                {KANBAN_COLUMNS.map((column) => (
                  <div className="kanban-column" key={column.id}>
                    <div className="kanban-column-header">
                      <h3>{column.label}</h3>
                      <span className="badge">{tasksByKanban[column.id].length}</span>
                    </div>
                    <ul className="list compact-list kanban-ticket-list">
                      {tasksByKanban[column.id].length ? (
                        tasksByKanban[column.id].map((task) => {
                          const pendingApproval = task.approvals?.some((approval) => approval.status === "PENDING");

                          return (
                            <li key={task.id}>
                              <button
                                className={`kanban-ticket ${selectedKanbanTask?.id === task.id ? "active" : ""}`}
                                onClick={() => setSelectedKanbanTaskId(task.id)}
                                type="button"
                              >
                                <strong>{task.title}</strong>
                                <span className="meta">{task.assignee.name} ({task.assignee.role})</span>
                                <div className="panel-row wrap">
                                  <span className={`badge status-${task.status}`}>{formatTaskStatusLabel(task.status)}</span>
                                  {pendingApproval ? <span className="badge">Needs Review</span> : null}
                                </div>
                              </button>
                            </li>
                          );
                        })
                      ) : (
                        <li className="meta">No tasks in this column.</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="stack-column">
              <div className="panel-section kanban-detail-panel">
                <h2>Ticket Detail</h2>
                {selectedKanbanTask ? (
                  <>
                    <div className="card kanban-detail-card">
                      <h3>{selectedKanbanTask.title}</h3>
                      <div className="panel-row wrap">
                        <span className={`badge status-${selectedKanbanTask.status}`}>{formatTaskStatusLabel(selectedKanbanTask.status)}</span>
                        {selectedKanbanTask.approvals?.some((approval) => approval.status === "PENDING") ? <span className="badge">Needs Review</span> : null}
                      </div>

                      <p className="meta task-description">{selectedKanbanTask.description}</p>

                      <div className="kanban-meta-grid">
                        <div className="kanban-meta-item">
                          <span className="meta">Assigned By</span>
                          <strong>{selectedKanbanTask.createdBy?.name ?? "Operator"}</strong>
                        </div>
                        <div className="kanban-meta-item">
                          <span className="meta">Assigned To</span>
                          <strong>{selectedKanbanTask.assignee.name}</strong>
                        </div>
                        <div className="kanban-meta-item">
                          <span className="meta">Created</span>
                          <strong>{new Date(selectedKanbanTask.createdAt).toLocaleString()}</strong>
                        </div>
                        <div className="kanban-meta-item">
                          <span className="meta">Last Update</span>
                          <strong>{new Date(selectedKanbanTask.updatedAt).toLocaleString()}</strong>
                        </div>
                      </div>

                      <div>
                        <h3>Key Criteria</h3>
                        <ul className="list compact-list criteria-list">
                          {selectedKanbanCriteria.map((criterion, index) => (
                            <li className="meta" key={`${selectedKanbanTask.id}-criterion-${index}`}>
                              {criterion}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="panel-row wrap">
                        <button className="btn" onClick={() => openTaskThread(selectedKanbanTask.id)} type="button">
                          Open Thread
                        </button>
                        {selectedKanbanTask.approvals?.some((approval) => approval.status === "PENDING") ? (
                          <>
                            <button className="btn btn-accent" disabled={busy} onClick={() => approveTask(selectedKanbanTask.id)} type="button">
                              Approve
                            </button>
                            <button className="btn btn-danger" disabled={busy} onClick={() => rejectTask(selectedKanbanTask.id)} type="button">
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>

                      <select
                        className="select"
                        defaultValue=""
                        onChange={(event) => {
                          const to = event.target.value;
                          if (to) {
                            void handoffTask(selectedKanbanTask.id, to);
                            event.target.value = "";
                          }
                        }}
                      >
                        <option value="">Handoff to...</option>
                        {agents
                          .filter((agent) => agent.id !== selectedKanbanTask.assigneeId)
                          .map((agent) => (
                            <option key={`${selectedKanbanTask.id}-${agent.id}`} value={agent.id}>
                              {agent.name} ({agent.role})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="card">
                      <h3>Task Events</h3>
                      <ul className="list compact-list">
                        {selectedKanbanTask.events?.length ? (
                          selectedKanbanTask.events.map((event) => (
                            <li className="feed-item" key={event.id}>
                              <div>{event.message}</div>
                              <div className="meta">{new Date(event.createdAt).toLocaleTimeString()}</div>
                            </li>
                          ))
                        ) : (
                          <li className="meta">No task events yet.</li>
                        )}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="meta">No tasks available yet.</div>
                )}
              </div>

              <div className="panel-section activity-stream-panel">
                <h2>Live Activity Stream</h2>
                <div className="activity-stream">
                  {feed.length ? (
                    feed.slice(0, 30).map((item) => (
                      <div className={`activity-line category-${item.category.toLowerCase()}`} key={item.id}>
                        <span className="activity-time">{new Date(item.createdAt).toLocaleTimeString()}</span>
                        <span className="activity-message">{item.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="meta">Waiting for activity events...</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "TASKS" ? (
          <section className="screen-grid tasks-grid">
            <div className="panel-section">
              <h2>Task Board</h2>
              <ul className="list task-list">
                {tasks.map((task) => {
                  const pendingApproval = task.approvals?.find((approval) => approval.status === "PENDING");

                  return (
                    <li className="card" key={task.id}>
                      <h3>{task.title}</h3>
                      <div className="meta">{task.assignee?.name} ({task.assignee?.role})</div>
                      <p className="meta task-description">{task.description}</p>
                      <div className="panel-row wrap">
                        <span className={`badge status-${task.status}`}>{task.status}</span>
                        {pendingApproval ? <span className="badge">Approval Pending</span> : null}
                      </div>

                      {pendingApproval ? (
                        <div className="panel-row">
                          <button className="btn btn-accent" disabled={busy} onClick={() => approveTask(task.id)} type="button">
                            Approve
                          </button>
                          <button className="btn btn-danger" disabled={busy} onClick={() => rejectTask(task.id)} type="button">
                            Reject
                          </button>
                        </div>
                      ) : null}

                      <div className="panel-row">
                        <select
                          className="select"
                          defaultValue=""
                          onChange={(event) => {
                            const to = event.target.value;
                            if (to) {
                              void handoffTask(task.id, to);
                              event.target.value = "";
                            }
                          }}
                        >
                          <option value="">Handoff to...</option>
                          {agents
                            .filter((agent) => agent.id !== task.assigneeId)
                            .map((agent) => (
                              <option key={`${task.id}-${agent.id}`} value={agent.id}>
                                {agent.name} ({agent.role})
                              </option>
                            ))}
                        </select>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="stack-column">
              <div className="panel-section">
                <h2>Load Snapshot</h2>
                <div className="kpi-strip">
                  <div className="kpi">
                    <strong>{tasks.length}</strong>
                    <span>Total Tasks</span>
                  </div>
                  <div className="kpi">
                    <strong>{pendingApprovals.length}</strong>
                    <span>Needs Approval</span>
                  </div>
                  <div className="kpi">
                    <strong>{agents.length}</strong>
                    <span>Active Agents</span>
                  </div>
                </div>
              </div>

              <div className="panel-section">
                <h2>Recent Feed</h2>
                <ul className="list compact-list">
                  {feed.slice(0, 12).map((item) => (
                    <li className="feed-item card" key={item.id}>
                      <div>{item.message}</div>
                      <div className="meta">{new Date(item.createdAt).toLocaleTimeString()}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "CHAT" ? (
          <section className="screen-grid chat-grid">
            <div className="panel-section">
              <h2>Task Threads</h2>
              <ul className="list">
                {chatThreads.length ? (
                  chatThreads.map((thread) => (
                    <li className="card" key={thread.taskId}>
                      <button
                        className={`thread-button ${selectedThread?.taskId === thread.taskId ? "active" : ""}`}
                        onClick={() => setSelectedThreadTaskId(thread.taskId)}
                        type="button"
                      >
                        <strong>{thread.taskTitle}</strong>
                        <span className="meta">{thread.assignee.name} | {thread.taskStatus}</span>
                        <span className="meta">{new Date(thread.latestMessageAt).toLocaleString()}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="meta">No task conversations yet.</li>
                )}
              </ul>
            </div>

            <div className="panel-section chat-thread-panel">
              <h2>Thread</h2>
              {selectedThread ? (
                <>
                  <div className="meta">{selectedThread.taskTitle}</div>
                  <div className="chat-messages">
                    {selectedThread.messages.length ? (
                      selectedThread.messages.map((message) => (
                        <div className={`chat-bubble ${message.role === "OPERATOR" ? "operator" : "agent"}`} key={message.id}>
                          <div className="meta">
                            {message.role === "OPERATOR" ? "You" : message.senderName ?? "Agent"}
                            {message.recipientName ? ` -> ${message.recipientName}` : ""}
                          </div>
                          <div>{message.content}</div>
                          <div className="meta">{new Date(message.createdAt).toLocaleTimeString()}</div>
                        </div>
                      ))
                    ) : (
                      <div className="meta">No messages in this thread yet. Send one to direct this task.</div>
                    )}
                  </div>

                  <textarea
                    className="textarea"
                    placeholder="Tell the assignee exactly what to do next..."
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                  />
                  <div className="panel-row">
                    <button className="btn btn-accent" disabled={busy} onClick={sendChatMessage} type="button">
                      Send to {selectedThread.assignee.name.split(" ")[0]}
                    </button>
                  </div>
                </>
              ) : (
                <div className="meta">Choose a task thread to start chatting.</div>
              )}
            </div>
          </section>
        ) : null}

        {activeTab === "ORG" ? (
          <section className="screen-grid org-grid">
            <div className="panel-section">
              <h2>Org Map</h2>
              <div className="org-columns">
                <div className="org-column">
                  <h3>Director</h3>
                  {agentsByRole.DIRECTOR.map((agent) => (
                    <button className="org-agent" key={agent.id} onClick={() => setSelectedAgentId(agent.id)} type="button">
                      {agent.name}
                    </button>
                  ))}
                </div>
                <div className="org-column">
                  <h3>Managers</h3>
                  {agentsByRole.MANAGER.map((agent) => (
                    <button className="org-agent" key={agent.id} onClick={() => setSelectedAgentId(agent.id)} type="button">
                      {agent.name}
                    </button>
                  ))}
                </div>
                <div className="org-column">
                  <h3>Specialists</h3>
                  {agentsByRole.SPECIALIST.map((agent) => (
                    <button className="org-agent" key={agent.id} onClick={() => setSelectedAgentId(agent.id)} type="button">
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="stack-column">
              <div className="panel-section">
                <h2>Selected Agent</h2>
                {selectedAgent ? (
                  <div className="agent-drawer">
                    <h3>{selectedAgent.name}</h3>
                    <div className="meta">{selectedAgent.specialistRole ?? selectedAgent.role} | {selectedAgent.specialty}</div>
                    <div className="meta">XP {selectedAgent.stats?.xp ?? 0} | Level {selectedAgent.stats?.level ?? 1}</div>
                    <div className="meta">Mood {selectedAgent.stats?.mood ?? "NEUTRAL"}</div>
                    <div className="meta">Manager {selectedAgent.manager?.name ?? "None"}</div>
                    <div className="meta" style={{ marginTop: "0.4rem" }}>Tools</div>
                    <ul className="list compact-list">
                      {(selectedAgent.tools ?? []).map(({ tool }) => (
                        <li className="meta" key={tool.id}>
                          {tool.name} ({tool.executionMode})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="meta">Select an agent to inspect profile and tools.</div>
                )}
              </div>

              <div className="panel-section">
                <h2>OpenAI Tool Settings</h2>
                <div className="meta">Status: {openAIConfigured ? "Configured" : "Not configured"}</div>
                <label className="meta">Model</label>
                <input className="input" value={openAIModel} onChange={(event) => setOpenAIModel(event.target.value)} />
                <label className="meta">API Key</label>
                <input
                  className="input"
                  type="password"
                  placeholder={openAIConfigured ? "Leave blank to keep existing key" : "sk-..."}
                  value={openAIKeyInput}
                  onChange={(event) => setOpenAIKeyInput(event.target.value)}
                />
                <button className="btn btn-accent" disabled={busy} onClick={saveOpenAISettings} type="button">
                  Save Tool Settings
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "MEMORY" ? (
          <section className="screen-grid memory-screen-grid">
            <div className="panel-section">
              <h2>Memory Bank</h2>
              <p className="meta">Set persistent notes that shape how each agent writes, prioritizes, and collaborates.</p>
              <ul className="memory-grid">
                {memoryGroups.map((group) => (
                  <li className="card memory-card" key={group.id}>
                    <h3>{group.name}</h3>
                    <div className="meta">{group.role}</div>
                    <ul className="list compact-list memory-list">
                      {group.memories.length ? (
                        group.memories.map((memory) => (
                          <li className="memory-item" key={memory.id}>
                            <div>{memory.content}</div>
                            <div className="meta">{new Date(memory.updatedAt).toLocaleString()}</div>
                            <button className="btn btn-danger ghost" onClick={() => deleteMemory(memory.id)} type="button">
                              Remove
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="meta">No memories set yet.</li>
                      )}
                    </ul>

                    <textarea
                      className="textarea"
                      placeholder="Example: Keep delivery updates under 6 bullets with explicit risks."
                      value={memoryDrafts[group.id] ?? ""}
                      onChange={(event) =>
                        setMemoryDrafts((current) => ({
                          ...current,
                          [group.id]: event.target.value
                        }))
                      }
                    />
                    <button className="btn btn-accent" disabled={busy} onClick={() => saveMemory(group.id)} type="button">
                      Save Memory
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {activeTab === "GOVERNANCE" ? (
          <section className="screen-grid governance-grid">
            <div className="panel-section">
              <h2>Integrations + Permissions</h2>
              <div className="card">
                <h3>GitHub Workspace</h3>
                <div className="meta">Status: {githubIntegration?.authStatus ?? "DISCONNECTED"}</div>
                <div className="meta">Account: {githubIntegration?.accountLabel ?? "Not connected"}</div>
                <div className="panel-row wrap">
                  <button className="btn btn-accent" disabled={busy} onClick={connectGitHub} type="button">
                    Connect GitHub
                  </button>
                  <button className="btn" disabled={busy || !githubIntegration} onClick={fetchGithubRepos} type="button">
                    Load Repos
                  </button>
                </div>

                <label className="meta">Manual fallback code/token</label>
                <input
                  className="input"
                  placeholder="Paste GitHub OAuth code or token"
                  value={githubManualCode}
                  onChange={(event) => setGithubManualCode(event.target.value)}
                />
                <button className="btn" disabled={busy || !githubManualCode.trim()} onClick={submitGitHubManualCode} type="button">
                  Submit Manual Callback
                </button>

                <label className="meta">Repository Binding</label>
                <select
                  className="select"
                  value={selectedGithubRepoFullName}
                  onChange={(event) => setSelectedGithubRepoFullName(event.target.value)}
                >
                  <option value="">Select repo...</option>
                  {githubRepos.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName} ({repo.defaultBranch})
                    </option>
                  ))}
                </select>
                <button className="btn" disabled={busy || !selectedGithubRepoFullName || !githubIntegration} onClick={saveGitHubRepoBinding} type="button">
                  Save Repo Binding
                </button>
              </div>

              {githubIntegration ? (
                <div className="card">
                  <h3>GitHub Agent Capability Matrix</h3>
                  <ul className="list compact-list">
                    {agents.map((agent) => {
                      const caps = integrationCapabilityDrafts[githubIntegration.id]?.[agent.id] ?? [];

                      return (
                        <li key={`${githubIntegration.id}-${agent.id}`}>
                          <div className="meta">{agent.name}</div>
                          <div className="panel-row wrap">
                            {CAPABILITY_OPTIONS.map((capability) => (
                              <label className="meta" key={`${agent.id}-${capability}`} style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                <input
                                  type="checkbox"
                                  checked={caps.includes(capability)}
                                  onChange={() => toggleIntegrationCapability(githubIntegration.id, agent.id, capability)}
                                />
                                {capability}
                              </label>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <button className="btn btn-accent" disabled={busy} onClick={() => saveIntegrationPermissions(githubIntegration.id)} type="button">
                    Save Permission Matrix
                  </button>
                </div>
              ) : null}
            </div>

            <div className="stack-column">
              <div className="panel-section">
                <h2>Security Holds</h2>
                <div className="panel-row wrap">
                  <select className="select" value={holdScope} onChange={(event) => setHoldScope(event.target.value as "TASK" | "WORKSPACE")}>
                    <option value="TASK">Task Hold</option>
                    <option value="WORKSPACE">Workspace Hold</option>
                  </select>
                  <select
                    className="select"
                    value={holdSeverity}
                    onChange={(event) => setHoldSeverity(event.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
                <input className="input" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} />
                <button className="btn btn-danger" disabled={busy} onClick={createSecurityHold} type="button">
                  Place Security Hold
                </button>
                <ul className="list compact-list">
                  {securityHolds.slice(0, 12).map((hold) => (
                    <li className="card" key={hold.id}>
                      <div>
                        <strong>{hold.scope}</strong> | {hold.severity} | {hold.status}
                      </div>
                      <div className="meta">{hold.reason}</div>
                      <div className="meta">{new Date(hold.createdAt).toLocaleString()}</div>
                      {hold.status === "ACTIVE" ? (
                        <button className="btn" disabled={busy} onClick={() => releaseSecurityHold(hold.id)} type="button">
                          Release Hold
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-section">
                <h2>User Context Feed</h2>
                <select className="select" value={userContextType} onChange={(event) => setUserContextType(event.target.value as UserContextItem["type"])}>
                  <option value="GOAL">GOAL</option>
                  <option value="PREFERENCE">PREFERENCE</option>
                  <option value="STRENGTH">STRENGTH</option>
                  <option value="WEAKNESS">WEAKNESS</option>
                  <option value="BUSINESS_CONTEXT">BUSINESS_CONTEXT</option>
                  <option value="PRODUCT_CONTEXT">PRODUCT_CONTEXT</option>
                  <option value="WORKING_STYLE">WORKING_STYLE</option>
                </select>
                <input
                  className="input"
                  placeholder="Short title"
                  value={userContextTitle}
                  onChange={(event) => setUserContextTitle(event.target.value)}
                />
                <textarea
                  className="textarea"
                  placeholder="Context details"
                  value={userContextContent}
                  onChange={(event) => setUserContextContent(event.target.value)}
                />
                <label className="meta">Weight {userContextWeight}</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  value={userContextWeight}
                  onChange={(event) => setUserContextWeight(Number(event.target.value) || 0)}
                />
                <button className="btn btn-accent" disabled={busy} onClick={addUserContext} type="button">
                  Add Context
                </button>
                <ul className="list compact-list">
                  {userContexts.slice(0, 10).map((context) => (
                    <li className="card" key={context.id}>
                      <div>
                        <strong>{context.type}</strong> ({context.weight})
                      </div>
                      <div className="meta">{context.title}</div>
                      <div>{context.content}</div>
                      <button className="btn btn-danger ghost" disabled={busy} onClick={() => deleteUserContext(context.id)} type="button">
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-section">
                <h2>Learning Proposals</h2>
                <ul className="list compact-list">
                  {learningProposals.slice(0, 12).map((proposal) => (
                    <li className="card" key={proposal.id}>
                      <div>
                        <strong>{proposal.status}</strong> | {proposal.agent?.name ?? "Agent"}
                      </div>
                      <div>{proposal.title}</div>
                      <div className="meta">{proposal.rationale}</div>
                      <div className="meta">{new Date(proposal.createdAt).toLocaleString()}</div>
                      {proposal.status === "PENDING" ? (
                        <div className="panel-row">
                          <button className="btn btn-accent" disabled={busy} onClick={() => approveProposal(proposal.id)} type="button">
                            Approve
                          </button>
                          <button className="btn btn-danger" disabled={busy} onClick={() => rejectProposal(proposal.id)} type="button">
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel-section">
                <h2>Reflection Runs</h2>
                <ul className="list compact-list">
                  {reflectionRuns.slice(0, 10).map((run) => (
                    <li className="card" key={run.id}>
                      <div>
                        <strong>{run.status}</strong> | {run.agent?.name ?? "Workspace"}
                      </div>
                      <div className="meta">{run.analyzedEventCount} events analyzed</div>
                      <div className="meta">{run.summary}</div>
                      <div className="meta">{new Date(run.createdAt).toLocaleString()}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {error ? <div className="error-banner">{error}</div> : null}
    </div>
  );
}
