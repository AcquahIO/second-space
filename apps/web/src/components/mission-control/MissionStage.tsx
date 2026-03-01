"use client";

import type { WorkspaceSceneAgent, WorkspaceSceneIntegrationStatus, WorkspaceSceneResponse } from "@second-space/shared-types";
import OfficeSim from "@/components/OfficeSim";

interface MissionStageProps {
  scene: WorkspaceSceneResponse | null;
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
}

function describeGitHubReadiness(integration: WorkspaceSceneIntegrationStatus | null): string {
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

export default function MissionStage({ scene, selectedAgentId, onSelectAgent }: MissionStageProps) {
  const agents = scene?.agents ?? [];
  const github = scene?.integrations?.items.find((integration) => integration.provider === "GITHUB") ?? null;

  return (
    <div className="panel-section sim-panel mission-sim-panel">
      <div className="sim-caption">Minecraft-style Agent Office</div>
      <div className="sim-card">
        <OfficeSim agents={agents} selectedAgentId={selectedAgentId} onSelectAgent={onSelectAgent} />
      </div>
      {scene ? (
        <div className="mission-scene-summary">
          <span>{scene.summary.onlineAgents} agents live</span>
          <span>{scene.summary.approvalCount} approvals</span>
          <span>{scene.summary.activeHoldCount} holds</span>
          <span>{describeGitHubReadiness(github)}</span>
          {scene.workspace.blockedByWorkspaceHold ? <span>Workspace write-blocked</span> : null}
        </div>
      ) : null}
      <div className="agent-chip-row">
        {agents.map((agent: WorkspaceSceneAgent) => (
          <button
            className={`agent-chip ${selectedAgentId === agent.id ? "active" : ""}`}
            key={agent.id}
            onClick={() => onSelectAgent(agent.id)}
            type="button"
          >
            {agent.name.split(" ")[0]} {agent.state}
          </button>
        ))}
      </div>
      <div className="mission-stage-footer">Agent Floor</div>
    </div>
  );
}
