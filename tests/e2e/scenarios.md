# E2E Scenarios

1. Signup and workspace bootstrap
- Open `/signup`.
- Create workspace owner account.
- Verify workspace record, subscription (trialing), and seeded 11-agent roster (includes Security).

2. Mission Control bootstrap and scoped realtime
- Login and open Mission Control.
- Verify `GET /api/presentation/workspace-scene` returns `scene.version = "v1"`.
- Verify `POST /api/presentation/session` returns a short-lived presentation token.
- Verify the worker websocket accepts the tokenized connection and rejects a missing/invalid token.
- Verify Mission Control updates from `presentation.scene.patch` without a page refresh.

3. Selected-agent chat streaming
- Select PM in Mission Control.
- Send a natural message.
- Verify the reply streams incrementally.
- Verify the final event includes `readyToExecute`, `draftId`, and `actionHints`.
- Verify `Go` only appears when PM is ready to execute.

4. Integration onboarding and permissions
- Connect GitHub/LinkedIn/Gmail integration callbacks.
- For GitHub, verify OAuth callback flow and manual fallback when client secret is unavailable.
- Bind workspace repo (`repoOwner`, `repoName`, `defaultBranch`).
- Assign per-agent capability permissions.
- Verify integrations list excludes plaintext token fields.

5. Workspace-aware PM guidance
- Ask PM to review code with GitHub disconnected.
- Verify PM says GitHub is missing and renders `Connect GitHub`.
- Connect GitHub without binding a repo.
- Ask again and verify PM says the repo must be bound and renders `Bind Repo`.
- Use `Upload Files Instead` and verify the knowledge/file fallback is available.

6. Knowledge ingestion and retrieval path
- Add note + URL + file source.
- Verify source and chunk creation.
- Trigger command and confirm worker task metadata records knowledge usage.

7. Approval guardrail
- Submit mission with write verbs (post/send/push).
- Verify tasks move to `PENDING_APPROVAL` until approved.
- Approve and verify completion.

8. GitHub branch guardrail
- Trigger GitHub mission targeting `main` branch.
- Verify task fails with guardrail message.
- Trigger same mission on feature branch and verify success.

9. LinkedIn fallback
- Execute LinkedIn mission with fallback enabled.
- Verify output is manual-post draft instead of direct publish.

10. Schedule trigger loop
- Create natural-language weekly/hourly schedule.
- Wait for due run or set near-term schedule.
- Verify schedule emits `schedule.triggered` and creates task(s).

11. Security hold lifecycle
- Place task-level security hold via `/api/security/holds`.
- Verify target task remains blocked.
- Release hold via `/api/security/holds/:id/release` and verify task can continue.

12. Organic learning loop
- Add user context via `/api/user-context`.
- Generate enough activity to create memory events.
- Verify reflection run appears and creates `PENDING` contract proposal.
- Approve/reject proposal and verify resolved status + realtime update.

13. Workspace data isolation
- Create two workspaces via two accounts.
- Verify API calls in one session cannot access records from the other workspace.
