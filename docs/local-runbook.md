# Local Runbook

## Prerequisites
- Node 20+
- npm 10+
- PostgreSQL
- Redis
- Docker (optional)

## Environment
1. `cp .env.example .env`
2. Required baseline values:
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `CREDENTIAL_ENCRYPTION_KEY` (or rely on `SESSION_SECRET` fallback)
- `APP_BASE_URL`
3. Optional but recommended:
- `OPENAI_API_KEY`
- `OPENAI_EMBED_MODEL`
- Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`)
- OAuth client config (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `GOOGLE_CLIENT_ID`)

## Bootstrap
```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Start apps
```bash
npm run dev
```
- Web: `http://localhost:3000`
- Worker WS: `ws://localhost:4001`

## Smoke checks
1. Create account at `/signup` and login.
2. Confirm `GET /api/workspace` returns workspace + subscription.
3. Confirm `/api/integrations` returns workspace integration records.
4. Add a note via `/api/knowledge/note` and check `/api/knowledge/sources`.
5. Create a schedule via `/api/schedules` and verify worker logs schedule triggers.
6. Parse/confirm an `execute` mission command and verify task lifecycle/approvals.
7. Parse/confirm a `plan` mode command and verify no execution tasks are launched.
8. Create a manual security hold via `/api/security/holds` and verify blocked task behavior.
9. Verify learning proposals list at `/api/learning/proposals`.

## Build/test commands
```bash
npm run db:generate
npm run build --workspace=@second-space/web
npm run build --workspace=@second-space/worker
npm run build --workspace=@second-space/tool-adapters
npm run test --workspace=@second-space/shared-types
npm run test --workspace=@second-space/tool-adapters
npm run test --workspace=@second-space/web
npm run test --workspace=@second-space/worker
```

## Notes
- `npm run test` at repo root uses Turbo and may crash in some local environments; run per-workspace commands instead.
- Worker package includes memory redaction tests in `apps/worker/src/learning/memory.test.ts`.
