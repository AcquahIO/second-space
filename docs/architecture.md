# Architecture

## Services
- **Web (`apps/web`)**
  - Next.js UI and API routes.
  - Signup/login/session auth with workspace-scoped access.
  - Billing, onboarding, integrations, knowledge, and schedules APIs.
  - Command parsing (`explore/plan/execute/review`) + task creation/approval flows.
  - User-context, security-hold, and learning-proposal governance APIs.
  - Redis realtime event publication.

- **Worker (`apps/worker`)**
  - BullMQ task execution consumer.
  - Schedule trigger loop that creates recurring missions.
  - Workspace knowledge context retrieval for task prompts.
  - Integration-aware tool execution with agent permission checks.
  - Approval enforcement for write actions.
  - Security precheck + hold enforcement (task/workspace).
  - Memory event capture + redaction + retention purge.
  - Weekly reflection cycle that proposes contract refinements (no auto-apply).
  - Simulation tick and WebSocket realtime gateway.

- **PostgreSQL**
  - Durable source of truth for workspaces, users, subscriptions, agents, tasks, approvals, integrations, knowledge, schedules, events, memory events, security holds, user context, reflection runs, and contract proposals.

- **Redis**
  - BullMQ queue backend.
  - Pub/Sub fanout for realtime events.

## Core data flow
1. Owner signs up and gets a new workspace.
2. Workspace bootstrap creates specialist team, default tools, and onboarding baseline.
3. Owner onboards integrations/knowledge and can configure schedules.
4. Owner issues manual command (`POST /api/commands`) with mode.
5. `plan` mode produces structure only; `execute` mode creates workspace-scoped task graph.
6. Worker executes tasks using provider adapters, contracts, user context, long-term memory, and knowledge.
7. Security precheck runs on external-write paths; risky actions can be blocked via security holds.
8. Any write action without approved authorization is moved to `PENDING_APPROVAL`.
9. Reflection schedules generate learning proposals for CEO approval.
10. Realtime events update dashboard, feed, approvals, holds, proposals, and simulation state.

## Safety model
- Write actions are gated by explicit approval.
- GitHub default/protected branch direct push is blocked.
- Integration capability checks are per-agent and per-workspace.
- Security holds can block task or workspace write execution.
- Credentials are stored encrypted and never returned in plaintext responses.
- Memory pipeline redacts token/secret patterns before persistence.

## Simulation model
- Existing waypoint graph from `packages/sim-engine` is preserved.
- Agent states map to active task statuses.
- Worker writes `sim_positions` and publishes state/position events.

## Scheduling model
- NL schedule text is parsed into recurrence strings.
- Worker polls due schedules, creates mission tasks, updates next run time, and emits `schedule.triggered` events.
- Reflection schedules trigger memory analysis and contract proposal generation (propose-only).
