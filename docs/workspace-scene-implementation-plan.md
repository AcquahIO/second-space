# Workspace Scene Implementation Plan

## Purpose
Convert the proposed `GET /api/presentation/workspace-scene` contract into a concrete implementation plan for `/Users/charlesacquah-davis/Code/second-space/apps/web`.

This is an engineering build plan, not just an API concept.

## Goal
Create a production-oriented scene bootstrap endpoint that:
- aggregates current workspace scene data in one request
- exposes only presentation-safe fields
- gives UE5 a stable bootstrap contract
- avoids duplicating business logic in the Unreal client

## Proposed Files

### New route
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/presentation/workspace-scene/route.ts`

### New scene assembler service
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/lib/presentation/workspace-scene.ts`

### New presentation shared types
- `/Users/charlesacquah-davis/Code/second-space/packages/shared-types/src/presentation.ts`

### Shared-types export update
- `/Users/charlesacquah-davis/Code/second-space/packages/shared-types/src/index.ts`

### Tests
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/lib/presentation/workspace-scene.test.ts`
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/presentation/workspace-scene/route.test.ts` if route tests are added in this repo later

## Existing Inputs to Reuse

### Existing APIs and data shapes
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/agents/route.ts`
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/sim/snapshot/route.ts`
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/tasks/route.ts`
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/feed/route.ts`

### Existing auth utilities
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/lib/auth/server-auth.ts`
- `/Users/charlesacquah-davis/Code/second-space/apps/web/src/lib/auth/session.ts`

### Existing waypoint source
- `/Users/charlesacquah-davis/Code/second-space/packages/sim-engine/src/office.ts`

## Implementation Steps

### Step 1: Add shared presentation types
Create `/Users/charlesacquah-davis/Code/second-space/packages/shared-types/src/presentation.ts` with:
- `WorkspaceSceneView`
- `WorkspaceSceneZone`
- `WorkspaceSceneStatusTone`
- `WorkspaceSceneBadge`
- `WorkspaceSceneAgent`
- `WorkspaceSceneSummary`
- `WorkspaceSceneIntegrationSummary`
- `WorkspaceSceneSelectedAgent`
- `WorkspaceSceneTaskSummary`
- `WorkspaceSceneFeedItem`
- `WorkspaceSceneResponse`

Export them from:
- `/Users/charlesacquah-davis/Code/second-space/packages/shared-types/src/index.ts`

### Step 2: Build the assembler service
Create `/Users/charlesacquah-davis/Code/second-space/apps/web/src/lib/presentation/workspace-scene.ts`.

It should export:
- `buildWorkspaceScene(workspaceId: string, options?: BuildWorkspaceSceneOptions)`
- `resolveSceneZone(x: number, y: number): WorkspaceSceneZone`
- `mapAgentStateToStatusTone(state: AgentState): WorkspaceSceneStatusTone`

### Step 3: Query data directly from Prisma
Do not make server-side HTTP calls to existing APIs. Use Prisma directly in the assembler.

Recommended assembler query set:
- workspace
- workspace subscription
- agents with:
  - stats
  - simPosition
  - manager
- recent tasks
- recent feed
- pending approvals count
- active security holds summary
- workspace integrations

### Step 4: Derive scene fields server-side
The assembler should compute:
- `zone` from sim position using current waypoint geometry
- `statusTone` from agent state
- `sceneSummary` counts
- selected-agent summary
- sanitized integration readiness summary

### Step 5: Add route
Create `/Users/charlesacquah-davis/Code/second-space/apps/web/src/app/api/presentation/workspace-scene/route.ts`.

Responsibilities:
- read session
- enforce workspace auth
- parse optional query params:
  - `view`
  - `selectedAgentId`
  - `include`
- call `buildWorkspaceScene(...)`
- return JSON response

## Query Parameter Plan

### `view`
Allow:
- `office`
- `overview`

Default:
- `office`

### `selectedAgentId`
Optional:
- enriches `selectedAgent`
- if invalid or out-of-workspace, ignore rather than fail hard

### `include`
Optional scene expansions:
- `tasks`
- `feed`
- `integrations`
- `holds`
- `approvals`

Default behavior:
- include scene essentials
- keep payload small

## Zone Derivation Plan

### Rule
Use current coordinates from:
- `/Users/charlesacquah-davis/Code/second-space/packages/sim-engine/src/office.ts`

### Initial implementation
Resolve the nearest named waypoint by Euclidean distance.

Pseudo-logic:
```ts
function resolveSceneZone(x: number, y: number): WorkspaceSceneZone {
  return nearestWaypointName(x, y);
}
```

This is good enough for phase 1 because the worker already drives positions using the same waypoint graph.

### Future refinement
Move to explicit zone polygons or room bounding boxes if layout `v2` changes.

## Response Assembly Plan

### `workspace`
Source:
- workspace
- subscription

### `scene`
Source:
- fixed view param
- current timestamp
- waypoint map from sim-engine
- camera preset string

### `agents`
Source:
- agent rows + stats + sim positions

Derived per agent:
- `zone`
- `badge.label`
- `badge.statusTone`
- `badge.selected`

### `selectedAgent`
Source:
- selected id
- latest feed
- task counts

### `sceneSummary`
Derived:
- online agent count
- meeting count
- blocked count
- working count
- pending approvals
- active holds

### `integrations`
Source:
- workspace integrations

Sanitize to:
- provider readiness only
- GitHub repo binding if present
- never return secrets or tokens

### `feed`
Source:
- recent feed items

### `tasks`
Source:
- recent tasks

Return only lightweight scene-facing fields.

## Data Safety Rules
- never expose `accessTokenEncrypted`
- never expose raw token metadata that contains secrets
- never expose internal worker-only control fields
- return presentation-safe summaries only

## Testing Plan

### Unit tests for assembler
Add tests for:
- empty workspace fallbacks
- zone derivation from current waypoint map
- state-to-tone mapping
- selected-agent enrichment
- integration sanitization
- scene summary counts

### Route tests
When route test infra exists, cover:
- unauthorized request returns `401`
- authenticated request returns scene payload
- optional params work
- `selectedAgentId` outside workspace is ignored

## Acceptance Criteria
- one API call can bootstrap the UE scene
- response includes stable actor ids and scene-ready fields
- no secrets are exposed
- response shape is versionable and reusable
- assembler is server-side and query-based, not HTTP-chained

## Suggested Implementation Sequence
1. add shared presentation types
2. implement scene assembler
3. implement route
4. add unit tests
5. wire integration doc to prefer this endpoint for production UE bootstrap

## Out of Scope for This Implementation
- websocket changes
- Pixel Streaming auth bridge
- changes to worker movement logic
- changes to chat/orchestration behavior
