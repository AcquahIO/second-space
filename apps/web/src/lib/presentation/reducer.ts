import type { PresentationSceneEventPayload, WorkspaceSceneResponse } from "@second-space/shared-types";

export function applyPresentationScenePatch(
  current: WorkspaceSceneResponse,
  changes: PresentationSceneEventPayload["changes"]
): WorkspaceSceneResponse {
  return {
    ...current,
    scene: changes.scene
      ? {
          ...current.scene,
          ...changes.scene
        }
      : current.scene,
    summary: changes.summary ?? current.summary,
    agents: changes.agents ?? current.agents,
    selectedAgent: Object.prototype.hasOwnProperty.call(changes, "selectedAgent") ? changes.selectedAgent ?? null : current.selectedAgent,
    integrations: changes.integrations ?? current.integrations,
    tasks: changes.tasks ?? current.tasks,
    feed: changes.feed ?? current.feed,
    approvals: changes.approvals ?? current.approvals,
    holds: changes.holds ?? current.holds
  };
}

export type PresentationSceneState = {
  scene: WorkspaceSceneResponse | null;
};

export type PresentationSceneAction =
  | {
      type: "bootstrap";
      scene: WorkspaceSceneResponse;
    }
  | {
      type: "patch";
      changes: PresentationSceneEventPayload["changes"];
    }
  | {
      type: "reset";
    };

export function presentationSceneReducer(
  state: PresentationSceneState,
  action: PresentationSceneAction
): PresentationSceneState {
  switch (action.type) {
    case "bootstrap":
      return { scene: action.scene };
    case "patch":
      if (!state.scene) {
        return state;
      }
      return {
        scene: applyPresentationScenePatch(state.scene, action.changes)
      };
    case "reset":
      return { scene: null };
    default:
      return state;
  }
}
