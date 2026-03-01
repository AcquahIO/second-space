# UE5 Presentation Client Contract

## Purpose
This document is the implementation-facing handoff for the Unreal client team. It describes exactly how a UE5 presentation client should bootstrap, authenticate, subscribe to realtime scene changes, and map the response into Unreal-side data structures.

## Backend surfaces to consume
- `GET /api/presentation/workspace-scene`
- `POST /api/presentation/session`
- websocket event `presentation.scene.patch`

The Unreal client should not call lower-level task, feed, hold, or integration APIs for the office scene bootstrap. Those concerns are already folded into the presentation contract.

## Authentication model
The user still authenticates through the existing Second Space workspace session flow in the web layer. Unreal then uses the presentation session exchange to obtain a short-lived websocket token.

### Bootstrap sequence
1. Establish an authenticated workspace session.
2. Call `GET /api/presentation/workspace-scene?view=office&include=feed,integrations,approvals,holds`.
3. Render the initial office scene from that response.
4. Call `POST /api/presentation/session` with `{ "channel": "presentation" }`.
5. Open the websocket using the returned `presentationToken`.
6. Apply each `presentation.scene.patch` event to the local scene state.

## Bootstrap response
`GET /api/presentation/workspace-scene`

### Required fields
- `workspace`
- `scene`
- `summary`
- `agents`
- `selectedAgent`

### Important scene fields
- `scene.version`
- `scene.view`
- `scene.cameraPreset`
- `scene.generatedAt`
- `scene.waypoints`
- `scene.zoneOccupancy`

### Important agent fields
- `id`
- `name`
- `role`
- `specialistRole`
- `state`
- `mood`
- `simPosition`
- `zone`
- `badge`

## Realtime session exchange
`POST /api/presentation/session`

### Request body
```json
{
  "channel": "presentation"
}
```

### Response body
```json
{
  "websocketUrl": "ws://localhost:4001",
  "presentationToken": "<short-lived-token>",
  "expiresAt": "2026-03-01T12:05:00.000Z",
  "channel": "presentation"
}
```

### Rules
- token is workspace-scoped
- token expires after 5 minutes
- websocket connections without a valid token are rejected
- cross-workspace subscriptions are rejected

## Realtime payload
Event type:
- `presentation.scene.patch`

### Payload shape
```json
{
  "type": "presentation.scene.patch",
  "payload": {
    "workspaceId": "ws_123",
    "channel": "presentation",
    "changes": {
      "scene": {
        "generatedAt": "2026-03-01T12:12:00.000Z",
        "zoneOccupancy": []
      },
      "agents": [],
      "summary": {
        "onlineAgents": 11,
        "meetingCount": 2,
        "blockedCount": 1,
        "workingCount": 6,
        "approvalCount": 2,
        "activeHoldCount": 1
      }
    }
  },
  "emittedAt": "2026-03-01T12:12:00.000Z"
}
```

### Patch semantics
- `changes` is a partial scene patch
- top-level slices may appear independently
- Unreal should merge only the slices included in the event
- slices not present in the patch should remain unchanged locally

### Slice list
Possible `changes` keys:
- `scene`
- `summary`
- `agents`
- `selectedAgent`
- `feed`
- `approvals`
- `holds`
- `integrations`
- `tasks`

## Unreal-side data model recommendation

### Core structs
- `FWorkspaceSceneState`
- `FWorkspaceSceneAgent`
- `FWorkspaceSceneSummary`
- `FWorkspaceSceneZoneOccupancy`
- `FWorkspaceSceneSelectedAgent`
- `FWorkspaceScenePatch`

### Suggested ownership
- `UGameInstanceSubsystem` or `UWorldSubsystem`
  - holds current scene state
  - handles bootstrap fetch
  - handles websocket session/token exchange
  - applies incremental patches
- `AActor` managers
  - spawn/update office agents
  - manage waypoint interpolation
  - manage status badges and zone overlays

## Mapping rules

### Waypoints
The office layout must continue to honor the current waypoint semantics from `/Users/charlesacquah-davis/Code/second-space/packages/sim-engine/src/office.ts`.

Zones:
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

### Agent state to animation
- `IDLE` -> idle loop
- `MOVING` -> walk/interpolate
- `WORKING` -> desk/focus loop
- `MEETING` -> seated/listening or meeting loop
- `BLOCKED` -> blocked posture with UI emphasis

### Badge/state tone
- `neutral`
- `moving`
- `working`
- `meeting`
- `blocked`

These should drive material/UI accent changes, not core simulation logic.

## Error handling
- if `GET /api/presentation/workspace-scene` fails, Unreal should remain on the last known stable scene and show a connection-state banner
- if websocket token exchange fails, retry with backoff
- if websocket disconnects, renew the presentation session and reconnect
- if token expires, request a new presentation session rather than retrying with the stale token

## Boundary rules
- Unreal is presentation-only
- Unreal must not invent or mutate orchestration state
- Unreal must not bypass approvals, holds, or security gating
- Unreal must not receive or persist credential material

## Current implementation note
This contract is already implemented in the web + worker stack inside this repo. The next Unreal task is to consume it as-is, not redesign it again.
