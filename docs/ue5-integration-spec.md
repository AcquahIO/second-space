# UE5 Integration Spec

## Goal
Integrate a UE5 office scene with the existing Second Space backend so the Unreal client renders agent presence, movement, and workspace state without becoming a second source of truth.

## Related Docs
- [Proposed API: `GET /api/presentation/workspace-scene`](./ue5-presentation-workspace-scene-api.md)
- [Workspace Scene Implementation Plan](./workspace-scene-implementation-plan.md)
- [UE5 Vertical Slice Brief](./ue5-vertical-slice-brief.md)

## Principle
The web app and worker continue to own state. Unreal renders it.

## Scope
This spec covers:
- state bootstrap from current APIs
- realtime sync from current websocket events
- scene mapping for agents, rooms, and statuses
- recommended auth and deployment model for prototype and production

## Non-Goals
- Moving orchestration logic into UE
- Running agent chat inside UE
- Replacing the current dashboard APIs
- Replacing task, approval, or integration governance

## Current System of Record

### Web
- `apps/web`
- Owns auth, workspace APIs, dashboard APIs, integrations, chat, and approvals

### Worker
- `apps/worker`
- Owns execution, simulation ticks, realtime events, and task-state-driven agent movement

### Shared domain rules
- `packages/shared-types`
- `packages/sim-engine`

## Current Interfaces UE Can Reuse

### REST bootstrap
- `GET /api/workspace`
- `GET /api/agents`
- `GET /api/tasks`
- `GET /api/feed`
- `GET /api/sim/snapshot`
- `GET /api/integrations`

### Realtime stream
- websocket default: `ws://localhost:4001`
- current dashboard consumes:
  - `sim.agent.position.updated`
  - `sim.agent.state.updated`
  - `feed.event`
  - `task.created`
  - `task.updated`
  - `approval.requested`
  - `approval.resolved`
  - `security.hold.placed`
  - `security.hold.released`

## Current Auth Model
- session cookie: `second_space_session`
- cookie issued by web app
- workspace context is derived from the signed session payload

## Recommendation by Phase

### Prototype
- UE runs as a presentation client in a controlled environment
- use the same authenticated session context through a browser-hosted or internal wrapper flow
- acceptable for local and internal validation

### Production
- do not make raw Unreal clients depend directly on browser cookies
- add a thin presentation auth bridge or token exchange for the UE client if this becomes a shipped runtime

## Recommended Architecture

### Source of truth
1. `apps/web` and `apps/worker` own workspace state
2. UE client requests initial scene data
3. UE client subscribes to realtime updates
4. UE updates visual state only

### Preferred production bootstrap
For prototype work, UE can reuse the current dashboard-facing endpoints.

For production, the preferred bootstrap should become:
- `GET /api/presentation/workspace-scene`

That proposed contract is defined in:
- [Proposed API: `GET /api/presentation/workspace-scene`](./ue5-presentation-workspace-scene-api.md)

### Scene data flow
1. User authenticates into Second Space
2. UE client receives workspace-scoped access context
3. UE requests bootstrap APIs
4. UE creates agents and room occupancy state
5. UE applies websocket events incrementally
6. User interactions in UE call back into existing web APIs where needed

## Bootstrap Data Contract

### Workspace
Use `GET /api/workspace` for:
- workspace name
- subscription state
- high-level workspace context

### Agents
Use `GET /api/agents` for:
- `id`
- `name`
- `role`
- `specialistRole`
- `specialty`
- `state`
- `manager`
- `stats.mood`
- `simPosition.x`
- `simPosition.y`

Recommended UE representation:
```ts
type AgentView = {
  id: string;
  name: string;
  role: "DIRECTOR" | "MANAGER" | "SPECIALIST";
  specialistRole?: string;
  specialty: string;
  state: "IDLE" | "MOVING" | "WORKING" | "MEETING" | "BLOCKED";
  mood?: "FOCUSED" | "NEUTRAL" | "STRESSED";
  simPosition?: { x: number; y: number } | null;
};
```

### Tasks
Use `GET /api/tasks` for:
- current visible work
- assignee info
- status
- approvals presence
- recent events

Recommended UE usage:
- not for core movement
- yes for room summaries, task badges, attention indicators

### Feed
Use `GET /api/feed` for:
- recent events shown in scene overlays
- activity ticker or status pill

### Simulation snapshot
Use `GET /api/sim/snapshot` for:
- authoritative starting positions for all agents

### Integrations
Use `GET /api/integrations` for:
- workspace readiness indicators
- whether GitHub/Gmail/LinkedIn are connected
- optional scene signage such as "repo not connected"

## Realtime Contract

### Position update
Event:
- `sim.agent.position.updated`

Payload fields currently used by the dashboard:
- `agentId`
- `x`
- `y`

UE handling:
- update target world-space position
- interpolate, do not teleport unless the delta is extreme

### State update
Event:
- `sim.agent.state.updated`

Payload fields currently used by the dashboard:
- `agentId`
- `state`

UE handling:
- update animation state machine
- update state indicator color
- optionally re-route the agent toward the correct zone

### Feed event
Event:
- `feed.event`

Payload fields:
- `id`
- `message`
- `category`
- `createdAt`

UE handling:
- optional top-level status pill
- optional room event chips

### Task and approval events
Events:
- `task.created`
- `task.updated`
- `approval.requested`
- `approval.resolved`
- `security.hold.placed`
- `security.hold.released`

UE handling:
- refresh task summaries
- refresh selected-agent overlays
- update blocked/attention visuals when applicable

## Waypoint Mapping
The UE office layout must honor the current waypoint semantics from `packages/sim-engine/src/office.ts`.

### Required waypoint anchors
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

### Rule
Art layout can evolve, but these semantic anchors must remain stable so worker-driven movement still makes sense.

## State-to-Scene Mapping

### `IDLE`
- ambient idle loop
- agent stands or lightly shifts in assigned zone

### `MOVING`
- walk loop
- actor interpolates toward latest target

### `WORKING`
- desk or standing-focus animation
- attach to relevant pod or desk zone

### `MEETING`
- occupy meeting room cluster
- use listening/nodding loop

### `BLOCKED`
- route to waiting area or blocked posture
- add subtle visual callout, not aggressive warning spam

## Suggested UE Runtime Model

### Core actors
- `BP_AgentCharacter`
- `BP_AgentMarker`
- `BP_RoomZone`
- `BP_WorkspaceSceneController`

### Core data containers
- `DA_AgentArchetype`
- `DA_RoomDefinition`
- `ST_AgentRuntimeState`
- `ST_FeedEvent`

### Scene controller responsibilities
- load bootstrap data
- own websocket subscription
- map backend ids to spawned actors
- apply updates
- forward selection changes to UI layer

## Interaction Spec

### Supported in slice
- select agent
- focus camera on agent
- inspect room occupancy
- show current state/status
- optionally open corresponding web panel or deep link

### Not supported in slice
- full mission execution from UE
- writing task state directly from UE
- managing approvals from UE in phase 1

## Deployment Paths

### Local prototype
- run UE locally
- point it at local Second Space web and websocket endpoints

### Internal hosted demo
- Pixel Streaming is acceptable after the slice is approved
- Unreal remains presentation-only

### Public production
- requires:
  - auth bridge or token exchange
  - hardened websocket/auth story
  - environment-specific endpoint configuration

## Required Backend Additions Before Production
Current interfaces are enough for a prototype, but production will be cleaner with:
- one normalized presentation bootstrap endpoint
- one authenticated workspace-scoped realtime contract
- explicit scene-summary payload for approvals, holds, and integration readiness

Recommended future endpoint:
- `GET /api/presentation/workspace-scene`

Recommended payload:
- agents
- positions
- state summaries
- room occupancy
- approvals count
- blocked count
- integration readiness summary

## Failure Handling

### REST failure
- show scene shell with loading/error state
- do not spawn partial phantom agents

### Realtime disconnect
- keep scene active
- show reconnect state
- fallback to periodic refresh

### Stale position/state
- periodic reconciliation via `GET /api/agents` and `GET /api/sim/snapshot`

## Definition of Done
Integration is complete for the slice when:
- UE can bootstrap from the current workspace APIs
- UE can consume current websocket events
- agents visibly move and change state based on live data
- waypoint zones align with the current sim model
- no business logic is duplicated inside UE
