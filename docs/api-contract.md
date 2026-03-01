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
- `POST /api/integrations/:provider/callback` (`/api/integrations/:id/callback` route parameter maps to provider)
- `GET /api/integrations/:id`
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

## Existing Mission Ops
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

## Realtime events
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

## Notes
- All authenticated endpoints are workspace-scoped using `workspaceId` from session token.
- Integration responses are sanitized; encrypted token fields are never returned.
- `POST /api/commands` accepts optional `mode` (`explore`, `plan`, `execute`, `review`).
