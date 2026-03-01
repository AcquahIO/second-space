# UE5 Sprint 0 Backlog

## Purpose
Convert Sprint 0 into issue-ready backlog items that can drop straight into GitHub Issues, Linear, or a Kanban board.

## Suggested Board Columns
- `Backlog`
- `Ready`
- `In Progress`
- `Review`
- `Done`

## Labels
- `ue5`
- `sprint-0`
- `art`
- `environment`
- `character`
- `animation`
- `integration`
- `backend`
- `review`
- `critical`

## Issue Format
Each backlog item should contain:
- title
- objective
- owner role
- estimate
- dependencies
- deliverables
- acceptance criteria

## Backlog Items

### UE5-001: Lock Visual Direction Keywords
- Type: issue
- Labels: `ue5`, `sprint-0`, `art`, `critical`
- Owner role: `Creative Director`
- Estimate: `0.5d`
- Dependencies: none

Objective:
- finalize the positive and negative style keywords for the UE slice

Deliverables:
- approved keyword list
- approved anti-keyword list

Acceptance criteria:
- keywords are written down
- anti-keywords are written down
- style direction disputes are resolved enough to begin reference gathering

### UE5-002: Build Moodboard and Reference Board
- Type: issue
- Labels: `ue5`, `sprint-0`, `art`, `critical`
- Owner role: `Product/Design Lead`
- Estimate: `1d`
- Dependencies: `UE5-001`

Objective:
- create the reference board using the required categories in `/Users/charlesacquah-davis/Code/second-space/docs/ue5-moodboard-reference-board.md`

Deliverables:
- full board with annotated references
- anti-reference section

Acceptance criteria:
- every section exists
- every image has a note
- anti-references are included
- the board supports the Second Space style instead of generic inspiration

### UE5-003: Finalize Character Proportion Sheet
- Type: issue
- Labels: `ue5`, `sprint-0`, `character`, `critical`
- Owner role: `Creative Director`, `Character Artist`
- Estimate: `0.5d`
- Dependencies: `UE5-001`

Objective:
- lock the hero-agent proportions before modeling starts

Deliverables:
- final proportion sheet

Acceptance criteria:
- head, torso, limb, and silhouette proportions are approved
- proportions support the current Second Space identity

### UE5-004: Produce Office Floor Plan
- Type: issue
- Labels: `ue5`, `sprint-0`, `environment`, `critical`
- Owner role: `Product/Design Lead`, `Environment Artist`
- Estimate: `0.75d`
- Dependencies: `UE5-001`

Objective:
- convert current sim waypoints into a real office layout using `/Users/charlesacquah-davis/Code/second-space/docs/ue5-office-floor-plan.md`

Deliverables:
- top-down floor plan
- zone mapping approval

Acceptance criteria:
- all current waypoints are mapped
- movement corridors are plausible
- blocked, meeting, work, and lounge zones are distinct

### UE5-005: Create UE5 Project Skeleton
- Type: issue
- Labels: `ue5`, `sprint-0`, `integration`, `critical`
- Owner role: `UE Engineer`
- Estimate: `0.5d`
- Dependencies: none

Objective:
- create the UE5 project and base folder structure for Sprint 0

Deliverables:
- working UE project
- agreed folder structure

Acceptance criteria:
- project opens cleanly
- folders are documented
- new assets can be placed without naming ambiguity

### UE5-006: Build Base Character Blockout
- Type: issue
- Labels: `ue5`, `sprint-0`, `character`, `critical`
- Owner role: `Character Artist`
- Estimate: `1d`
- Dependencies: `UE5-003`

Objective:
- build a blockout for one hero agent

Deliverables:
- base character blockout mesh

Acceptance criteria:
- silhouette reads from the target camera
- character still feels like a Second Space agent

### UE5-007: Build Office Corner Blockout
- Type: issue
- Labels: `ue5`, `sprint-0`, `environment`, `critical`
- Owner role: `Environment Artist`
- Estimate: `1d`
- Dependencies: `UE5-004`, `UE5-005`

Objective:
- block out one office corner, preferably meeting-room edge or desk pod cluster

Deliverables:
- office corner blockout scene

Acceptance criteria:
- zone reads clearly from target camera
- geometry supports the floor plan semantics

### UE5-008: Lock Camera Preset
- Type: issue
- Labels: `ue5`, `sprint-0`, `art`, `critical`
- Owner role: `Product/Design Lead`, `UE Engineer`
- Estimate: `0.5d`
- Dependencies: `UE5-007`

Objective:
- lock the camera framing for the vertical slice

Deliverables:
- named camera preset
- approved screenshot frame

Acceptance criteria:
- scene reads from one camera
- no free rotation is required to understand the room

### UE5-009: First Lighting Pass
- Type: issue
- Labels: `ue5`, `sprint-0`, `environment`, `critical`
- Owner role: `UE Engineer`, `Environment Artist`
- Estimate: `0.75d`
- Dependencies: `UE5-007`, `UE5-008`

Objective:
- establish the base lighting direction for the slice

Deliverables:
- first lit scene

Acceptance criteria:
- lighting matches the art bible
- lighting does not drift into photoreal harshness

### UE5-010: First Material Pass
- Type: issue
- Labels: `ue5`, `sprint-0`, `art`
- Owner role: `Character Artist`, `Environment Artist`
- Estimate: `1d`
- Dependencies: `UE5-006`, `UE5-007`

Objective:
- establish first material pass for hero character and office corner

Deliverables:
- first-pass materials

Acceptance criteria:
- materials feel premium from the target camera
- materials do not rely on noise or grunge for quality

### UE5-011: Build Motion Test
- Type: issue
- Labels: `ue5`, `sprint-0`, `animation`
- Owner role: `Technical Artist / Animator`
- Estimate: `1d`
- Dependencies: `UE5-006`

Objective:
- prove the character can idle and walk with the right feeling

Deliverables:
- idle test
- walk test

Acceptance criteria:
- motion feels alive
- motion reads from office-camera distance

### UE5-012: Prove Waypoint-to-Scene Mapping
- Type: issue
- Labels: `ue5`, `sprint-0`, `integration`, `critical`
- Owner role: `UE Engineer`, `Backend Engineer`
- Estimate: `0.75d`
- Dependencies: `UE5-004`, `UE5-005`

Objective:
- prove the current waypoint semantics can map into the UE scene cleanly

Deliverables:
- documented waypoint anchors
- scene mapping notes

Acceptance criteria:
- all current waypoints have one clear scene anchor
- there is no unresolved mismatch between sim logic and art layout

### UE5-013: Validate Backend Contract for UE Prototype
- Type: issue
- Labels: `ue5`, `sprint-0`, `backend`
- Owner role: `Backend Engineer`, `UE Engineer`
- Estimate: `0.5d`
- Dependencies: `UE5-012`

Objective:
- validate the current APIs and websocket events needed by the UE prototype

Deliverables:
- contract validation note
- missing-data list if any

Acceptance criteria:
- required bootstrap inputs are confirmed
- required realtime inputs are confirmed
- any missing fields are documented

### UE5-014: Produce Sprint 0 Review Pack
- Type: issue
- Labels: `ue5`, `sprint-0`, `review`, `critical`
- Owner role: `Product/Design Lead`
- Estimate: `0.5d`
- Dependencies: `UE5-002` through `UE5-013`

Objective:
- prepare the review pack for the go/no-go decision

Deliverables:
- hero screenshots
- office corner screenshots
- camera frame
- risks and open questions

Acceptance criteria:
- review pack is complete enough for leadership decision-making

### UE5-015: Run Sprint 0 Decision Review
- Type: issue
- Labels: `ue5`, `sprint-0`, `review`, `critical`
- Owner role: `Creative Director`, `Product/Design Lead`
- Estimate: `0.5d`
- Dependencies: `UE5-014`

Objective:
- decide whether to continue, pivot to look-dev-only, or stop

Deliverables:
- explicit decision
- next-step note

Acceptance criteria:
- decision is written down
- next phase is clear

## Backlog Ordering
Recommended order:
1. `UE5-001`
2. `UE5-002`
3. `UE5-003`
4. `UE5-004`
5. `UE5-005`
6. `UE5-006`
7. `UE5-007`
8. `UE5-008`
9. `UE5-009`
10. `UE5-010`
11. `UE5-011`
12. `UE5-012`
13. `UE5-013`
14. `UE5-014`
15. `UE5-015`

## Use With Existing Docs
- floor plan reference:
  - `/Users/charlesacquah-davis/Code/second-space/docs/ue5-office-floor-plan.md`
- task-board reference:
  - `/Users/charlesacquah-davis/Code/second-space/docs/ue5-sprint-0-task-board.md`
- integration reference:
  - `/Users/charlesacquah-davis/Code/second-space/docs/workspace-scene-implementation-plan.md`
