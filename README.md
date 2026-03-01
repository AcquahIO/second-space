# Second Space

Second Space is a simulation-first SaaS control room where a founder onboards a specialist AI workforce to run core business operations.

## V1 capabilities
- Workspace signup/login with one owner per workspace.
- Stripe checkout/webhook scaffolding for subscription state.
- 11-agent specialist roster bootstrap:
  - Project manager
  - Tech lead
  - Software engineer
  - QA tester
  - DevOps engineer
  - Security agent
  - Content agent
  - Marketing agent
  - Finance agent
  - Customer support agent
  - Operations/logistics agent
- PM command modes: `explore`, `plan`, `execute`, `review`.
- Workspace-scoped orchestration, approvals, chat, memory, and simulation.
- Organic learning loop:
  - User context feed (`user-context`)
  - Memory events + redaction pipeline
  - Weekly reflection runs
  - CEO-approved contract proposals (propose-only)
- Workspace integrations + per-agent capability permissions:
  - GitHub
  - LinkedIn
  - Gmail
- Knowledge base ingestion:
  - File content
  - URL ingestion
  - Manual notes
  - Chunking + optional embeddings
- Natural-language schedule parsing and recurring mission triggers.
- Guardrails:
  - External/write actions require explicit approval.
  - GitHub direct pushes to default branches are blocked.
  - Security holds can block risky task/workspace execution.
  - LinkedIn has manual-draft fallback when direct posting is unavailable.

## Monorepo layout
- `apps/web`: Next.js UI + API routes.
- `apps/worker`: queue consumer + simulation + scheduler + realtime gateway.
- `packages/shared-types`: shared domain/events/state contracts.
- `packages/sim-engine`: simulation movement logic.
- `packages/tool-adapters`: OpenAI + provider adapters.
- `prisma`: database schema + seed.
- `infra/docker-compose.yml`: local stack.

## Quickstart (local)
1. Copy env:
```bash
cp .env.example .env
```
2. Install deps:
```bash
npm install
```
3. Generate Prisma client + migrate + seed:
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```
4. Start apps:
```bash
npm run dev
```
5. Open app: `http://localhost:3000`
6. Signup a workspace at `http://localhost:3000/signup`

## Scripts
- `npm run dev`: web + worker.
- `npm run build`: build all workspaces.
- `npm run test`: test all workspaces (Turbo may fail in some local envs; run per workspace if needed).
- `npm run db:generate`: generate Prisma client.
- `npm run db:migrate`: push schema.
- `npm run db:seed`: seed a workspace owner + 11-agent roster.

## Key docs
- `docs/architecture.md`
- `docs/api-contract.md`
- `docs/operator-manual.md`
- `docs/local-runbook.md`
- `docs/ue5-vertical-slice-brief.md`
- `docs/ue5-art-bible.md`
- `docs/ue5-moodboard-reference-board.md`
- `docs/ue5-office-floor-plan.md`
- `docs/ue5-integration-spec.md`
- `docs/ue5-presentation-workspace-scene-api.md`
- `docs/workspace-scene-implementation-plan.md`
- `docs/ue5-asset-production-checklist.md`
- `docs/ue5-sprint-0-kickoff.md`
- `docs/ue5-sprint-0-task-board.md`
- `docs/ue5-sprint-0-backlog.md`
