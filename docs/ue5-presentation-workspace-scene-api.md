# Proposed API: `GET /api/presentation/workspace-scene`

## Purpose
Define a production-facing bootstrap endpoint for presentation clients such as a UE5 office scene. This endpoint should consolidate the current scene-relevant workspace state into one response so the Unreal client does not need to fan out across multiple dashboard APIs on startup.

## Status
Proposed, not implemented.

## Why This Endpoint Should Exist
Current prototype integration can reuse:
- `GET /api/workspace`
- `GET /api/agents`
- `GET /api/tasks`
- `GET /api/feed`
- `GET /api/sim/snapshot`
- `GET /api/integrations`

That is acceptable for internal validation, but not ideal for a production presentation client because:
- startup requires multiple round trips
- scene-specific derived fields have to be recomputed client-side
- auth and data minimization are harder to manage cleanly
- UE will need a stable contract that is scene-oriented, not dashboard-oriented

## Endpoint
- Method: `GET`
- Path: `/api/presentation/workspace-scene`

## Auth
- Workspace-scoped authenticated request
- Same workspace identity model as the rest of the app
- Response must not expose secrets, access tokens, or raw tool credentials

## Query Parameters

### Optional
- `view`
  - allowed values:
    - `office`
    - `overview`
  - default: `office`

- `selectedAgentId`
  - optional agent id
  - used to provide enriched selected-agent payload

- `include`
  - optional comma-separated expansions
  - allowed values:
    - `tasks`
    - `feed`
    - `integrations`
    - `holds`
    - `approvals`

Recommended default:
- `view=office`
- include scene essentials only

## Response Design Principles
- one workspace-scoped scene snapshot
- no secrets
- include scene-ready derived summaries
- preserve stable ids for actor binding
- keep payload small enough for first render

## Proposed Response Shape

```json
{
  "workspace": {
    "id": "ws_123",
    "name": "Second Space Workspace",
    "slug": "default-workspace",
    "subscriptionStatus": "TRIALING"
  },
  "scene": {
    "view": "office",
    "generatedAt": "2026-03-01T02:00:00.000Z",
    "cameraPreset": "isometric_office_v1",
    "waypoints": {
      "lobby": { "x": 120, "y": 120 },
      "directorDesk": { "x": 260, "y": 110 },
      "managerDeskA": { "x": 320, "y": 200 },
      "managerDeskB": { "x": 240, "y": 230 },
      "specialistPodA": { "x": 390, "y": 280 },
      "specialistPodB": { "x": 455, "y": 260 },
      "meetingRoom": { "x": 170, "y": 300 },
      "waitingArea": { "x": 90, "y": 280 },
      "breakArea": { "x": 510, "y": 160 }
    }
  },
  "agents": [
    {
      "id": "agent-project_manager",
      "name": "Parker Project",
      "role": "DIRECTOR",
      "specialistRole": "PROJECT_MANAGER",
      "specialty": "Turn CEO intent into successful outcomes by planning, delegating, coordinating, and closing work across the full agent team.",
      "state": "MEETING",
      "mood": "FOCUSED",
      "managerId": null,
      "simPosition": { "x": 170, "y": 300 },
      "zone": "meetingRoom",
      "badge": {
        "label": "Parker",
        "statusTone": "meeting",
        "selected": false
      }
    }
  ],
  "selectedAgent": {
    "id": "agent-project_manager",
    "title": "Project Manager",
    "summary": "Directs mission intake, delegation, coordination, and delivery.",
    "currentTaskCount": 3,
    "blockedTaskCount": 0,
    "latestFeedMessage": "PM ready to launch onboarding review mission."
  },
  "sceneSummary": {
    "onlineAgents": 11,
    "meetingCount": 2,
    "blockedCount": 1,
    "workingCount": 5,
    "approvalCount": 2,
    "activeHoldCount": 1
  },
  "integrations": {
    "github": {
      "authStatus": "DISCONNECTED",
      "connected": false,
      "repoFullName": null
    },
    "gmail": {
      "authStatus": "CONNECTED",
      "connected": true
    },
    "linkedin": {
      "authStatus": "DISCONNECTED",
      "connected": false
    }
  },
  "approvals": {
    "pendingCount": 2
  },
  "holds": {
    "activeCount": 1,
    "workspaceBlocked": false
  },
  "feed": [
    {
      "id": "feed_123",
      "category": "TASK",
      "message": "Task completed by Parker Project",
      "createdAt": "2026-03-01T01:59:00.000Z"
    }
  ],
  "tasks": [
    {
      "id": "task_123",
      "title": "Review onboarding code",
      "status": "IN_PROGRESS",
      "assigneeId": "agent-tech_lead",
      "assigneeName": "Taylor TechLead",
      "requiresApproval": false
    }
  ]
}
```

## Field Definitions

### `workspace`
Minimal identity and subscription context for the scene shell.

### `scene`
Static scene metadata the UE client can use immediately:
- `view`
- `generatedAt`
- `cameraPreset`
- `waypoints`

`waypoints` should mirror `packages/sim-engine/src/office.ts`.

### `agents`
This is the core actor bootstrap array.

Required fields:
- `id`
- `name`
- `role`
- `specialistRole`
- `specialty`
- `state`
- `mood`
- `managerId`
- `simPosition`
- `zone`

### `selectedAgent`
Optional enriched block for whichever agent the scene or UI is focused on.

### `sceneSummary`
Scene-oriented derived counts so the UE client does not need to compute them from raw data every time.

### `integrations`
Sanitized readiness summary only.

No tokens.
No secrets.
No encrypted raw fields.

### `approvals`
Condensed approval queue counts for scene badges.

### `holds`
Condensed security hold status for blocked visuals.

### `feed`
Trimmed recent activity for scene pills or overlays.

### `tasks`
Optional lightweight task list for labels, room summaries, or selected-agent context.

## Derived Field Rules

### `zone`
Derived from current sim position or current worker waypoint target.

Allowed values:
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

### `statusTone`
Derived from agent state:
- `IDLE` -> `neutral`
- `MOVING` -> `moving`
- `WORKING` -> `working`
- `MEETING` -> `meeting`
- `BLOCKED` -> `blocked`

## Data Sources in Current System
- `workspace` from current workspace query
- `agents` from `GET /api/agents`
- `simPosition` from `GET /api/sim/snapshot` or `agent.simPosition`
- `sceneSummary` derived from agent states + approvals + holds
- `integrations` from `GET /api/integrations`
- `feed` from `GET /api/feed`
- `tasks` from `GET /api/tasks`

## Recommended Server Assembly
Server should assemble this endpoint from existing internal queries rather than chaining HTTP requests internally.

Recommended internal sources:
- prisma workspace query
- prisma agent query with stats and sim positions
- task summary query
- approval pending summary query
- security hold summary query
- workspace integration summary query
- feed query

## Production Benefits
- one request for first render
- stable scene contract for UE
- smaller, cleaner payload than dashboard APIs
- easier auth hardening for presentation clients
- easier future support for Pixel Streaming

## Realtime Complement
This endpoint should be paired with the existing websocket event stream for incremental updates.

Initial bootstrap:
- `GET /api/presentation/workspace-scene`

Then apply:
- `sim.agent.position.updated`
- `sim.agent.state.updated`
- `feed.event`
- `task.created`
- `task.updated`
- `approval.requested`
- `approval.resolved`
- `security.hold.placed`
- `security.hold.released`

## Security Rules
- never include raw integration tokens
- never include encrypted credential blobs
- keep workspace-scoped access enforcement identical to existing APIs
- avoid returning internal-only fields irrelevant to presentation clients

## Suggested Implementation Order
1. create route scaffold in `apps/web`
2. build internal scene summary assembler
3. return stable versioned payload
4. update integration doc to treat this as preferred production bootstrap
5. keep existing APIs intact for the dashboard

## Definition of Done
This endpoint is ready when:
- the UE client can bootstrap from one request
- all required scene actors can spawn from the payload alone
- no sensitive data is exposed
- the response shape is stable enough for long-lived presentation clients
