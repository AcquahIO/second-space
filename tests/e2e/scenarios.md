# E2E Scenarios

1. Signup and workspace bootstrap
- Open `/signup`.
- Create workspace owner account.
- Verify workspace record, subscription (trialing), and seeded 11-agent roster (includes Security).

2. Integration onboarding and permissions
- Connect GitHub/LinkedIn/Gmail integration callbacks.
- For GitHub, verify OAuth callback flow and manual fallback when client secret is unavailable.
- Bind workspace repo (`repoOwner`, `repoName`, `defaultBranch`).
- Assign per-agent capability permissions.
- Verify integrations list excludes plaintext token fields.

3. Knowledge ingestion and retrieval path
- Add note + URL + file source.
- Verify source and chunk creation.
- Trigger command and confirm worker task metadata records knowledge usage.

4. Approval guardrail
- Submit mission with write verbs (post/send/push).
- Verify tasks move to `PENDING_APPROVAL` until approved.
- Approve and verify completion.

5. Command mode semantics
- Submit command with `mode=plan`.
- Confirm draft and verify no execution tasks are launched.
- Submit command with `mode=execute` and verify normal task launch.

6. GitHub branch guardrail
- Trigger GitHub mission targeting `main` branch.
- Verify task fails with guardrail message.
- Trigger same mission on feature branch and verify success.

7. LinkedIn fallback
- Execute LinkedIn mission with fallback enabled.
- Verify output is manual-post draft instead of direct publish.

8. Schedule trigger loop
- Create natural-language weekly/hourly schedule.
- Wait for due run or set near-term schedule.
- Verify schedule emits `schedule.triggered` and creates task(s).

9. Security hold lifecycle
- Place task-level security hold via `/api/security/holds`.
- Verify target task remains blocked.
- Release hold via `/api/security/holds/:id/release` and verify task can continue.

10. Organic learning loop
- Add user context via `/api/user-context`.
- Generate enough activity to create memory events.
- Verify reflection run appears and creates `PENDING` contract proposal.
- Approve/reject proposal and verify resolved status + realtime update.

11. Workspace data isolation
- Create two workspaces via two accounts.
- Verify API calls in one session cannot access records from the other workspace.
