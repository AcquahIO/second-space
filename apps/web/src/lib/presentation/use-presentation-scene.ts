"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  PresentationChannel,
  PresentationSceneEventPayload,
  PresentationSessionResponse,
  WorkspaceSceneInclude,
  WorkspaceSceneResponse
} from "@second-space/shared-types";
import { presentationSceneReducer } from "./reducer";

interface UsePresentationSceneOptions {
  include?: WorkspaceSceneInclude[];
  view?: "office" | "overview";
  initialSelectedAgentId?: string | null;
  channel?: PresentationChannel;
}

function buildSceneUrl(view: string, include: WorkspaceSceneInclude[], selectedAgentId: string | null): string {
  const params = new URLSearchParams({ view });
  if (include.length) {
    params.set("include", include.join(","));
  }
  if (selectedAgentId) {
    params.set("selectedAgentId", selectedAgentId);
  }

  return `/api/presentation/workspace-scene?${params.toString()}`;
}

export function usePresentationScene(options: UsePresentationSceneOptions = {}) {
  const include = options.include ?? ["feed", "integrations", "approvals", "holds"];
  const view = options.view ?? "office";
  const channel = options.channel ?? "dashboard";
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(options.initialSelectedAgentId ?? null);
  const [{ scene }, dispatch] = useReducer(presentationSceneReducer, { scene: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(
    async (nextSelectedAgentId?: string | null) => {
      const targetSelectedAgentId = nextSelectedAgentId ?? selectedAgentId ?? null;
      const response = await fetch(buildSceneUrl(view, include, targetSelectedAgentId));
      const payload = (await response.json()) as WorkspaceSceneResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? "Failed to load workspace scene");
      }

      dispatch({
        type: "bootstrap",
        scene: payload as WorkspaceSceneResponse
      });

      return payload as WorkspaceSceneResponse;
    },
    [include, selectedAgentId, view]
  );

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    refresh(selectedAgentId)
      .then(() => {
        if (mounted) {
          setError(null);
        }
      })
      .catch((loadError) => {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load workspace scene");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [refresh, selectedAgentId]);

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        const sessionResponse = await fetch("/api/presentation/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ channel })
        });
        const sessionPayload = (await sessionResponse.json()) as PresentationSessionResponse | { error?: string };

        if (!sessionResponse.ok) {
          throw new Error((sessionPayload as { error?: string }).error ?? "Failed to create presentation session");
        }

        const { websocketUrl, presentationToken } = sessionPayload as PresentationSessionResponse;
        const delimiter = websocketUrl.includes("?") ? "&" : "?";
        ws = new WebSocket(`${websocketUrl}${delimiter}token=${encodeURIComponent(presentationToken)}`);
        ws.onopen = () => {
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as {
              type: string;
              payload?: PresentationSceneEventPayload;
            };

            if (payload.type === "presentation.scene.patch" && payload.payload && typeof payload.payload === "object") {
              const changes = payload.payload.changes;
              if (changes && typeof changes === "object") {
                dispatch({
                  type: "patch",
                  changes
                });
              }
            }
          } catch {
            // Ignore malformed realtime payloads.
          }
        };

        ws.onclose = () => {
          if (!closed) {
            reconnectTimerRef.current = setTimeout(() => {
              void connect();
            }, 1500);
          }
        };
      } catch (connectionError) {
        if (!closed) {
          setError(connectionError instanceof Error ? connectionError.message : "Failed to connect realtime");
          reconnectTimerRef.current = setTimeout(() => {
            void connect();
          }, 1500);
        }
      }
    };

    void connect();

    return () => {
      closed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      ws?.close();
    };
  }, [channel]);

  const selectedAgent = useMemo(() => {
    if (!scene) {
      return null;
    }

    if (!selectedAgentId) {
      return scene?.selectedAgent ?? null;
    }

    return scene.agents.find((agent) => agent.id === selectedAgentId) ?? scene.selectedAgent ?? null;
  }, [scene, selectedAgentId]);

  return {
    scene,
    selectedAgent,
    selectedAgentId,
    setSelectedAgentId,
    refresh,
    loading,
    error
  };
}
