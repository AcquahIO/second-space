# API and Realtime Contracts

## Auth and Workspace
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/workspace`

## Billing
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

## Onboarding
- `GET /api/onboarding`
- `POST /api/onboarding/step`

## Integrations
- `GET /api/integrations`
- `POST /api/integrations/:provider/connect` (`/api/integrations/:id/connect` route parameter maps to provider)
- `GET /api/integrations/:provider/callback` OAuth code exchange (`/api/integrations/:id/callback`)
- `POST /api/integrations/:provider/callback` manual fallback (`/api/integrations/:id/callback`)
- `PATCH /api/integrations/:id` (repo owner/name/default branch metadata)
- `GET /api/integrations/:id/github/repos`
- `PATCH /api/integrations/:id/agent-permissions`

## Knowledge Base
- `GET /api/knowledge/sources`
- `POST /api/knowledge/files`
- `POST /api/knowledge/url`
- `POST /api/knowledge/note`
- `DELETE /api/knowledge/:sourceId`

## Schedules
- `GET /api/schedules`
- `POST /api/schedules/parse`
- `POST /api/schedules`
- `PATCH /api/schedules/:id`
- `DELETE /api/schedules/:id`

## Mission Ops
- `POST /api/commands`
- `POST /api/commands/:id/confirm`
- `GET /api/agents`
- `PATCH /api/agents/:id`
- `GET /api/tasks`
- `POST /api/tasks/:id/handoff`
- `POST /api/tasks/:id/approve`
- `POST /api/tasks/:id/reject`
- `GET /api/chat`
- `POST /api/chat`
- `GET /api/feed`
- `GET /api/memory`
- `POST /api/memory`
- `DELETE /api/memory/:id`
- `GET /api/settings/tools`
- `PUT /api/settings/tools/openai`
- `GET /api/sim/snapshot`
- `POST /api/voice/transcribe`

## Mission Control Presentation Surface
- `GET /api/presentation/workspace-scene`
  - workspace-scoped bootstrap snapshot for Mission Control and future presentation clients
  - query params:
    - `view=office|overview`
    - `selectedAgentId=<agentId>`
    - `include=feed,integrations,approvals,holds,tasks`
  - implemented scene fields include:
    - `scene.version = "v1"`
    - `scene.zoneOccupancy`
- `POST /api/presentation/session`
  - mints a short-lived workspace-scoped websocket token
  - request body: `{ "channel": "dashboard" | "presentation" }`
  - response:
    - `websocketUrl`
    - `presentationToken`
    - `expiresAt`
    - `channel`

## Agent Chat
- `POST /api/agent-chat`
  - non-streaming fallback for selected-agent chat
- `POST /api/agent-chat/stream`
  - `text/event-stream` route used by Mission Control
  - event types:
    - `token`
    - `final`
    - `error`
  - final message includes:
    - `reply`
    - `readyToExecute`
    - `draftId`
    - `actionHints`

## User Context and Learning
- `GET /api/user-context`
- `POST /api/user-context`
- `PATCH /api/user-context/:id`
- `DELETE /api/user-context/:id`
- `GET /api/learning/proposals`
- `POST /api/learning/proposals/:id/approve`
- `POST /api/learning/proposals/:id/reject`
- `GET /api/learning/reflections`

## Security Holds
- `GET /api/security/holds`
- `POST /api/security/holds`
- `POST /api/security/holds/:id/release`

## Realtime Events
Raw worker events still exist for internal/legacy consumers:
- `sim.agent.position.updated`
- `sim.agent.state.updated`
- `task.created`
- `task.updated`
- `task.handoff.requested`
- `approval.requested`
- `approval.resolved`
- `approval.queue.updated`
- `onboarding.step.completed`
- `integration.connected`
- `integration.connection_failed`
- `schedule.triggered`
- `feed.event`
- `security.hold.placed`
- `security.hold.released`
- `learning.proposal.created`
- `learning.proposal.resolved`

Presentation clients now consume:
- `presentation.scene.patch`
  - authenticated websocket event
  - workspace-scoped
  - payload:
    - `workspaceId`
    - `channel`
    - `changes`
    - `emittedAt`

## Notes
- All authenticated endpoints are workspace-scoped using `workspaceId` from the signed session token.
- Presentation websocket connections require a short-lived presentation token from `POST /api/presentation/session`.
- Integration responses are sanitized; encrypted token fields are never returned.
- `POST /api/commands` still accepts optional internal `mode` (`explore`, `plan`, `execute`, `review`), but Mission Control no longer exposes mode selection directly in the main PM chat flow.
