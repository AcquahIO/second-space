# UE5 Sprint 0 Task Board

## Purpose
Turn Sprint 0 into an execution board with clear owner roles, estimates, dependencies, and acceptance criteria.

## Assumed Roles
- `Creative Director`
- `Product/Design Lead`
- `Character Artist`
- `Environment Artist`
- `Technical Artist / Animator`
- `UE Engineer`
- `Backend Engineer`

One person can own multiple roles. These are responsibility lanes, not headcount requirements.

## Estimation Rules
- Estimates are ideal working days
- Sprint 0 target duration: `5` working days
- Tasks marked `critical` must be complete before the Sprint 0 review pack

## Task Board

| ID | Task | Owner | Estimate | Depends On | Priority | Acceptance Criteria |
|---|---|---|---:|---|---|---|
| S0-01 | Approve visual direction keywords and reject-list | Creative Director | 0.5d | None | Critical | Final keywords and anti-keywords are written down and accepted by project lead |
| S0-02 | Build the moodboard/reference board using the required categories | Product/Design Lead | 1d | S0-01 | Critical | Board contains all required sections, each reference is tagged and annotated, and anti-references are included |
| S0-03 | Finalize character proportion sheet from art bible | Creative Director, Character Artist | 0.5d | S0-01 | Critical | Proportion ranges for head, torso, limbs, and silhouette are locked |
| S0-04 | Draw top-down office floor plan aligned to current sim waypoints | Product/Design Lead, Environment Artist | 0.75d | S0-01 | Critical | Floor plan maps `lobby`, `directorDesk`, `managerDeskA`, `managerDeskB`, `specialistPodA`, `specialistPodB`, `meetingRoom`, `waitingArea`, and `breakArea` |
| S0-05 | Create UE5 project and folder structure | UE Engineer | 0.5d | None | Critical | Project opens cleanly, folders are named, and the team can place assets without ambiguity |
| S0-06 | Build base character blockout | Character Artist | 1d | S0-03 | Critical | One agent blockout exists and matches silhouette goals from the art bible |
| S0-07 | Build office corner blockout | Environment Artist | 1d | S0-04, S0-05 | Critical | One meeting-room edge or desk-pod corner exists and reads clearly from the target camera |
| S0-08 | Lock camera angle and framing | Product/Design Lead, UE Engineer | 0.5d | S0-07 | Critical | One approved camera preset exists and the scene reads without camera rotation |
| S0-09 | First lighting pass for the office corner | UE Engineer, Environment Artist | 0.75d | S0-07, S0-08 | Critical | Lighting matches the art bible mood and avoids photoreal drift |
| S0-10 | First material pass for hero character and office corner | Character Artist, Environment Artist | 1d | S0-06, S0-07 | High | Materials feel premium from the locked camera and do not rely on noisy detail |
| S0-11 | Build first idle and walk motion tests | Technical Artist / Animator | 1d | S0-06 | High | Character can idle and walk in a way that feels alive and readable from office-camera distance |
| S0-12 | Prove waypoint-to-scene mapping in UE | UE Engineer, Backend Engineer | 0.75d | S0-04, S0-05 | Critical | Scene anchors exist for current sim waypoint semantics and are documented |
| S0-13 | Validate current API and websocket contract against UE needs | Backend Engineer, UE Engineer | 0.5d | S0-12 | High | Required bootstrap and realtime fields are confirmed, and any missing data is listed |
| S0-14 | Produce Sprint 0 review pack | Product/Design Lead | 0.5d | S0-02 through S0-13 | Critical | Review pack contains hero screenshots, office corner screenshots, camera frame, and risk notes |
| S0-15 | Run go/no-go review | Creative Director, Product/Design Lead | 0.5d | S0-14 | Critical | Team explicitly chooses continue / look-dev only / stop |

## Daily Plan

### Day 1
- `S0-01`
- `S0-02`
- `S0-03`
- `S0-04`
- `S0-05`

### Day 2
- `S0-06`
- `S0-07`

### Day 3
- `S0-08`
- `S0-09`
- `S0-12`

### Day 4
- `S0-10`
- `S0-11`
- `S0-13`

### Day 5
- `S0-14`
- `S0-15`

## Review Checklist
- [ ] Moodboard approved
- [ ] Character silhouette approved
- [ ] Office corner approved
- [ ] Camera approved
- [ ] Lighting direction approved
- [ ] Material direction approved
- [ ] Motion test approved
- [ ] Waypoint mapping approved
- [ ] Integration constraints captured
- [ ] Go/no-go decision made

## Blockers That Must Be Escalated Immediately
- The office layout cannot map to the current sim waypoint semantics
- The character only looks good in closeups
- The style drifts toward realism
- The scene requires free camera movement to read properly
- The backend contract is missing fields required for the slice

## Sprint 0 Exit Conditions
- One screenshot-worthy hero agent exists
- One screenshot-worthy office corner exists
- Camera and lighting are locked
- The style still feels like Second Space
- The team has a documented decision on how to proceed
