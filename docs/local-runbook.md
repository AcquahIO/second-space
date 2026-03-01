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
3. Confirm `GET /api/presentation/workspace-scene` returns a scene snapshot with `scene.version = "v1"`.
4. Confirm `POST /api/presentation/session` returns `websocketUrl`, `presentationToken`, and `expiresAt`.
5. Connect Mission Control and verify websocket clients receive `presentation.scene.patch` events after task/sim changes.
6. Open PM chat, ask for a code review without GitHub connected, and verify the response includes a GitHub action hint.
7. Connect GitHub, bind a repo, and verify PM references the workspace connection state naturally.
8. Add a knowledge note via `/api/knowledge/note` and check `/api/knowledge/sources`.
9. Parse/confirm an `execute` mission and verify task lifecycle/approvals.
10. Place and release a security hold and verify Mission Control reflects the change.

## Build/test commands
```bash
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/worker/tsconfig.json
npx tsc --noEmit -p packages/shared-types/tsconfig.json
npx tsc --noEmit -p packages/sim-engine/tsconfig.json
npx tsc --noEmit -p packages/tool-adapters/tsconfig.json
npm run test --workspace=@second-space/web
npm run test --workspace=@second-space/worker
npm run build
```

## Notes
- Presentation websocket connections are no longer anonymous; Mission Control obtains a short-lived token first.
- Worker package includes memory redaction tests in `apps/worker/src/learning/memory.test.ts`.
- `npm run test` at repo root uses Turbo and may behave differently than per-workspace runs.
