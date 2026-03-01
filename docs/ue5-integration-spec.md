# UE5 Integration Spec

## Goal
Integrate a UE5 office scene with the existing Second Space backend so Unreal renders agent presence, movement, and workspace state without becoming a second source of truth.

## Principle
The web app and worker continue to own state. Unreal renders it.

## Implemented Presentation Contract
UE-facing backend scaffolding now exists in the repo:
- bootstrap snapshot: `GET /api/presentation/workspace-scene`
- presentation session/token exchange: `POST /api/presentation/session`
- authenticated websocket patch event: `presentation.scene.patch`

## Current Architecture
### Web
- `apps/web`
- owns auth, workspace APIs, dashboard APIs, integrations, chat, and approvals

### Worker
- `apps/worker`
- owns execution, simulation ticks, realtime events, and presentation websocket fanout

### Shared domain rules
- `packages/shared-types`
- `packages/sim-engine`

## Production Direction
### Bootstrap
UE should use:
- `GET /api/presentation/workspace-scene`

### Realtime
UE should:
1. authenticate through the existing workspace session flow or a controlled presentation bridge
2. call `POST /api/presentation/session`
3. open the worker websocket using the returned `presentationToken`
4. apply `presentation.scene.patch` events incrementally

### Contract Rules
- Unreal remains presentation-only
- Unreal does not own orchestration logic
- Unreal does not bypass approval/security gates
- Unreal does not receive raw credentials or secret material

## Scene Mapping
The office layout must continue to honor waypoint semantics from `packages/sim-engine/src/office.ts`:
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

## State Mapping
- `IDLE` -> ambient idle loop in assigned zone
- `MOVING` -> walk/interpolate toward latest target
- `WORKING` -> desk/focus loop in relevant pod
- `MEETING` -> meeting-room occupancy + listening loop
- `BLOCKED` -> blocked posture / attention indicator

## Remaining UE Work
What is still intentionally not in this repo:
- `.uproject` source
- asset pipeline
- Pixel Streaming deployment
- packaged UE runtime auth shell

## Repo Boundary
This repo now contains the backend/presentation scaffolding UE needs. The actual Unreal project should consume that contract, not duplicate backend logic.
