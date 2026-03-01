# UE5 Sprint 0 GitHub Issue Pack

## Purpose
Convert the Sprint 0 backlog into copy-paste-ready GitHub Issues.

Use this file when creating the first UE5 planning board in GitHub.

## Suggested Labels
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

## Issue Pack

### UE5-001: Lock Visual Direction Keywords
Labels: `ue5`, `sprint-0`, `art`, `critical`

**Objective**
- Finalize the positive and negative style keywords for the UE slice.

**Owner Role**
- Creative Director

**Estimate**
- 0.5d

**Dependencies**
- None

**Deliverables**
- Approved keyword list
- Approved anti-keyword list

**Acceptance Criteria**
- Keywords are written down
- Anti-keywords are written down
- Style direction disputes are resolved enough to begin reference gathering

### UE5-002: Build Moodboard and Reference Board
Labels: `ue5`, `sprint-0`, `art`, `critical`

**Objective**
- Create the reference board using the required categories in `/Users/charlesacquah-davis/Code/second-space/docs/ue5-moodboard-reference-board.md`.

**Owner Role**
- Product/Design Lead

**Estimate**
- 1d

**Dependencies**
- UE5-001

**Deliverables**
- Full board with annotated references
- Anti-reference section

**Acceptance Criteria**
- Every section exists
- Every image has a note
- Anti-references are included
- The board supports the Second Space style instead of generic inspiration

### UE5-003: Finalize Character Proportion Sheet
Labels: `ue5`, `sprint-0`, `character`, `critical`

**Objective**
- Lock the hero-agent proportions before modeling starts.

**Owner Role**
- Creative Director
- Character Artist

**Estimate**
- 0.5d

**Dependencies**
- UE5-001

**Deliverables**
- Final proportion sheet

**Acceptance Criteria**
- Head, torso, limb, and silhouette proportions are approved
- Proportions support the current Second Space identity

### UE5-004: Produce Office Floor Plan
Labels: `ue5`, `sprint-0`, `environment`, `critical`

**Objective**
- Convert current sim waypoints into a real office layout using `/Users/charlesacquah-davis/Code/second-space/docs/ue5-office-floor-plan.md`.

**Owner Role**
- Product/Design Lead
- Environment Artist

**Estimate**
- 0.75d

**Dependencies**
- UE5-001

**Deliverables**
- Top-down floor plan
- Zone mapping approval

**Acceptance Criteria**
- All current waypoints are mapped
- Movement corridors are plausible
- Blocked, meeting, work, and lounge zones are distinct

### UE5-005: Create UE5 Project Skeleton
Labels: `ue5`, `sprint-0`, `integration`, `critical`

**Objective**
- Create the UE5 project and base folder structure for Sprint 0.

**Owner Role**
- UE Engineer

**Estimate**
- 0.5d

**Dependencies**
- None

**Deliverables**
- Working UE project
- Agreed folder structure

**Acceptance Criteria**
- Project opens cleanly
- Folders are documented
- New assets can be placed without naming ambiguity

### UE5-006: Build Base Character Blockout
Labels: `ue5`, `sprint-0`, `character`, `critical`

**Objective**
- Build a blockout for one hero agent.

**Owner Role**
- Character Artist

**Estimate**
- 1d

**Dependencies**
- UE5-003

**Deliverables**
- Base character blockout mesh

**Acceptance Criteria**
- Silhouette reads from the target camera
- Character still feels like a Second Space agent

### UE5-007: Build Office Corner Blockout
Labels: `ue5`, `sprint-0`, `environment`, `critical`

**Objective**
- Block out one office corner, preferably meeting-room edge or desk pod cluster.

**Owner Role**
- Environment Artist

**Estimate**
- 1d

**Dependencies**
- UE5-004
- UE5-005

**Deliverables**
- Office corner blockout scene

**Acceptance Criteria**
- Zone reads clearly from target camera
- Geometry supports the floor plan semantics

### UE5-008: Lock Camera Preset
Labels: `ue5`, `sprint-0`, `art`, `critical`

**Objective**
- Lock the camera framing for the vertical slice.

**Owner Role**
- Product/Design Lead
- UE Engineer

**Estimate**
- 0.5d

**Dependencies**
- UE5-007

**Deliverables**
- Named camera preset
- Approved screenshot frame

**Acceptance Criteria**
- Scene reads from one camera
- No free rotation is required to understand the room

### UE5-009: First Lighting Pass
Labels: `ue5`, `sprint-0`, `environment`, `critical`

**Objective**
- Establish the base lighting direction for the slice.

**Owner Role**
- UE Engineer
- Environment Artist

**Estimate**
- 0.75d

**Dependencies**
- UE5-007
- UE5-008

**Deliverables**
- First lit scene

**Acceptance Criteria**
- Lighting matches the art bible
- Lighting does not drift into photoreal harshness

### UE5-010: First Material Pass
Labels: `ue5`, `sprint-0`, `art`

**Objective**
- Establish first material pass for hero character and office corner.

**Owner Role**
- Character Artist
- Environment Artist

**Estimate**
- 1d

**Dependencies**
- UE5-006
- UE5-007

**Deliverables**
- First-pass materials

**Acceptance Criteria**
- Materials feel premium from the target camera
- Materials do not rely on noise or grunge for quality

### UE5-011: Build Motion Test
Labels: `ue5`, `sprint-0`, `animation`

**Objective**
- Prove the character can idle and walk with the right feeling.

**Owner Role**
- Technical Artist / Animator

**Estimate**
- 1d

**Dependencies**
- UE5-006

**Deliverables**
- Idle test
- Walk test

**Acceptance Criteria**
- Motion feels alive
- Motion reads from office-camera distance

### UE5-012: Prove Waypoint-to-Scene Mapping
Labels: `ue5`, `sprint-0`, `integration`, `critical`

**Objective**
- Prove the current waypoint semantics can map into the UE scene cleanly.

**Owner Role**
- UE Engineer
- Backend Engineer

**Estimate**
- 0.75d

**Dependencies**
- UE5-004
- UE5-005

**Deliverables**
- Documented waypoint anchors
- Scene mapping notes

**Acceptance Criteria**
- All current waypoints have one clear scene anchor
- There is no unresolved mismatch between sim logic and art layout

### UE5-013: Validate Backend Contract for UE Prototype
Labels: `ue5`, `sprint-0`, `backend`

**Objective**
- Validate the current APIs and websocket events needed by the UE prototype.

**Owner Role**
- Backend Engineer
- UE Engineer

**Estimate**
- 0.5d

**Dependencies**
- UE5-012

**Deliverables**
- Contract validation note
- Missing-data list if any

**Acceptance Criteria**
- Required bootstrap inputs are confirmed
- Required realtime inputs are confirmed
- Any missing fields are documented

### UE5-014: Produce Sprint 0 Review Pack
Labels: `ue5`, `sprint-0`, `review`, `critical`

**Objective**
- Prepare the review pack for the go/no-go decision.

**Owner Role**
- Product/Design Lead

**Estimate**
- 0.5d

**Dependencies**
- UE5-002 through UE5-013

**Deliverables**
- Hero screenshots
- Office corner screenshots
- Camera frame
- Risks and open questions

**Acceptance Criteria**
- Review pack is complete enough for leadership decision-making

### UE5-015: Run Sprint 0 Decision Review
Labels: `ue5`, `sprint-0`, `review`, `critical`

**Objective**
- Decide whether to continue, pivot to look-dev-only, or stop.

**Owner Role**
- Creative Director
- Product/Design Lead

**Estimate**
- 0.5d

**Dependencies**
- UE5-014

**Deliverables**
- Explicit decision
- Next-step note

**Acceptance Criteria**
- Decision is written down
- Next phase is clear
