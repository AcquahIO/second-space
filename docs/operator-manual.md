# Second Space Operator Manual

## 1) Start and access
1. Bootstrap locally (`npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`).
2. Open `http://localhost:3000/signup` and create a workspace owner account.
3. Login at `http://localhost:3000/login`.

## 2) Initial workspace setup
1. Open Mission Control.
2. Configure OpenAI model/key in Org tab.
3. Connect integrations:
  - GitHub
  - LinkedIn
  - Gmail
4. Add agent permission scopes per integration.
5. In Governance tab, bind GitHub repo/default branch and verify capability matrix.
6. Review default Security hold controls.
7. Import knowledge sources (files, URLs, notes).
8. Mark onboarding steps complete as setup milestones are done.

## 3) Command workflow
1. Enter a mission in Command Bar.
2. Select mode (`explore`, `plan`, `execute`, `review`).
3. Parse command and review specialist task graph.
4. Confirm mode action:
  - `execute` launches tasks
  - `plan` stores planning output only (no execution launch)
5. Monitor Tasks, Feed, and simulation movement.

## 4) Approval workflow
1. Write/external actions enter approval queue.
2. Approve to allow execution or reject to block.
3. Reassign blocked work via task handoff when needed.

## 5) Schedule workflow
1. Create natural-language schedule definition.
2. Save recurring schedule with mission prompt and timezone.
3. Worker triggers due schedules and emits task + schedule events.

## 6) Chat and memory
1. Use Chat tab to issue task-specific instructions.
2. Use Memory tab to store persistent behavior constraints per agent.
3. Add user goals/preferences in Governance tab user-context panel.
4. Review weekly learning proposals and approve/reject them.

## 7) Guardrails
- All write actions require explicit human approval.
- GitHub pushes to default/protected branches are blocked.
- Security holds can block task/workspace write execution.
- LinkedIn may return manual-post drafts when direct posting is unavailable.
- Secrets/tokens are redacted before memory-event storage.
