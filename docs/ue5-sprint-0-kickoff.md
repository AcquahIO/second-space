# UE5 Sprint 0 Kickoff

## Purpose
Sprint 0 exists to remove ambiguity before full production starts. The output is not a finished office. The output is a locked direction, one approved hero look, and one approved office corner.

## Related Docs
- [UE5 Sprint 0 Task Board](./ue5-sprint-0-task-board.md)
- [UE5 Sprint 0 Backlog](./ue5-sprint-0-backlog.md)
- [UE5 Moodboard and Reference Board](./ue5-moodboard-reference-board.md)
- [UE5 Office Floor Plan](./ue5-office-floor-plan.md)
- [UE5 Art Bible](./ue5-art-bible.md)

## Sprint 0 Deliverables
- one-page art bible approved
- office floor plan aligned to current sim waypoints
- one hero agent concept translated into 3D
- one office corner built in UE5
- locked camera angle
- locked lighting direction
- go/no-go on full vertical slice production

## Required Inputs
- `/Users/charlesacquah-davis/Code/second-space/docs/ue5-vertical-slice-brief.md`
- `/Users/charlesacquah-davis/Code/second-space/docs/ue5-art-bible.md`
- `/Users/charlesacquah-davis/Code/second-space/docs/ue5-integration-spec.md`
- current waypoint map in `packages/sim-engine/src/office.ts`
- current product brand constraints

## Workstreams

### Workstream 1: style lock
- produce moodboard and color board
- approve final visual keywords
- reject anything too realistic or too noisy

### Workstream 2: hero character
- model one base agent
- validate silhouette from target camera
- validate face readability and materials

### Workstream 3: office corner
- build one meeting room edge or desk pod cluster
- validate environment style and spatial readability

### Workstream 4: technical spike
- prove UE can consume current data model
- map existing waypoint semantics into room anchors

## Exit Criteria
Sprint 0 is complete only when:
- there is one screenshot-worthy hero character
- there is one screenshot-worthy office corner
- the camera and lighting are locked
- the team agrees the style fits Second Space
- no one is still debating whether the project is stylized or realistic

## Immediate Task Breakdown
Use the detailed task board for owners, estimates, dependencies, and acceptance criteria:
- [UE5 Sprint 0 Task Board](./ue5-sprint-0-task-board.md)
- [UE5 Sprint 0 Backlog](./ue5-sprint-0-backlog.md)

### Day 1
- approve art bible
- draw top-down office plan
- list required hero character references

### Day 2
- block out base character proportions
- block out office corner geometry

### Day 3
- first lighting pass
- first material pass
- first camera review

### Day 4
- refine hero character
- refine office corner
- validate from final camera only

### Day 5
- produce review pack
- decide whether to continue to full slice

## Review Questions
- Does this still feel like Second Space?
- Do the agents still feel like your agents?
- Is the office readable without explanation?
- Does the scene feel premium enough to justify UE?
- Is the result better than continuing to iterate the web renderer alone?

## Stop Conditions
Pause the UE path if:
- the style drifts toward realism
- the agent identity gets lost
- the scene only looks good from cinematic closeups
- integration complexity starts driving art decisions

## Recommended Decision After Sprint 0
Choose one:
1. continue to full UE vertical slice
2. use UE for look-dev and port the style back into the web app
3. stop UE work and keep improving the current Three.js office
