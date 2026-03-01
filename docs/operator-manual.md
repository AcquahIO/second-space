# Second Space Operator Manual

## 1. Start and access
1. Bootstrap locally (`npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`).
2. Open `http://localhost:3000/signup` and create a workspace owner account.
3. Login at `http://localhost:3000/login`.

## 2. Initial workspace setup
1. Open Mission Control.
2. Configure the OpenAI model/key in Settings.
3. Connect integrations as needed:
   - GitHub
   - LinkedIn
   - Gmail
4. For GitHub, bind the repo/default branch the workspace should use.
5. Review per-agent capability permissions.
6. Add knowledge sources (files, URLs, notes).
7. Review default security hold controls.

## 3. Mission Control workflow
1. Stay on Mission Control.
2. Select the agent you want to talk to in the chat header. In most cases that should be PM.
3. Describe the mission naturally in the chat thread.
4. Let the selected agent ask clarifying questions if needed.
5. Use inline action hints when the agent surfaces missing setup:
   - `Connect GitHub`
   - `Bind Repo`
   - `Upload Files Instead`
   - `Open Integrations`
6. When PM has enough context, a `Go` button appears in the same thread.
7. Press `Go` to confirm execution.

## 4. Approval workflow
1. Write/external actions enter approval queue.
2. Approve to allow execution or reject to block.
3. Reassign blocked work via task handoff when needed.
4. Security holds override normal execution and must be cleared before write-capable tasks continue.

## 5. Schedule workflow
1. Create a natural-language schedule definition.
2. Save recurring schedule with mission prompt and timezone.
3. Worker triggers due schedules and emits task + schedule events.

## 6. Chat and memory
1. Use Mission Control for agent conversation and PM delegation.
2. Use Chat tab for task-thread-specific instructions.
3. Use Memory tab to store persistent behavior constraints per agent.
4. Add user goals/preferences in Settings via user-context.
5. Review weekly learning proposals and approve/reject them.

## 7. Guardrails
- All write actions require explicit human approval.
- GitHub direct pushes to default/protected branches are blocked.
- Security holds can block task/workspace write execution.
- LinkedIn may return manual-post drafts when direct posting is unavailable.
- Secrets/tokens are redacted before memory-event storage.
- Presentation websocket access is workspace-scoped and token-gated.
