# Implemented API: `GET /api/presentation/workspace-scene`

## Purpose
This is the presentation bootstrap endpoint for Mission Control and future UE5 presentation clients. It consolidates scene-relevant workspace state into one workspace-scoped response.

## Status
Implemented.

## Route
- Method: `GET`
- Path: `/api/presentation/workspace-scene`

## Auth
- Workspace-scoped authenticated request
- Same signed-session model as the rest of the app
- Response excludes secrets, access tokens, and raw credential material

## Query Parameters
- `view`
  - allowed: `office`, `overview`
  - default: `office`
- `selectedAgentId`
  - optional
  - enriches `selectedAgent` when valid for the workspace
- `include`
  - optional comma-separated expansions
  - allowed:
    - `tasks`
    - `feed`
    - `integrations`
    - `holds`
    - `approvals`

## Implemented Contract Highlights
- `scene.version = "v1"`
- `scene.waypoints` mirrors the current office waypoint semantics
- `scene.zoneOccupancy` is derived server-side
- `summary`, `agents`, and `selectedAgent` are presentation-ready
- `integrations`, `feed`, `approvals`, `holds`, and `tasks` are opt-in expansions

## Companion Presentation Auth Route
This endpoint is paired with:
- `POST /api/presentation/session`

That route returns:
- `websocketUrl`
- `presentationToken`
- `expiresAt`
- `channel`

## Companion Realtime Contract
Presentation clients subscribe over websocket and consume:
- `presentation.scene.patch`

Patch payload shape:
- `workspaceId`
- `channel`
- `changes`
- `emittedAt`

`changes` may contain top-level slices such as:
- `scene`
- `summary`
- `agents`
- `selectedAgent`
- `feed`
- `approvals`
- `holds`
- `integrations`
- `tasks`

## Why It Exists
Without this route, a presentation client has to fan out across multiple APIs at bootstrap and recompute scene-specific derivations client-side. This route centralizes that work and gives Mission Control and UE a stable scene-oriented contract.
