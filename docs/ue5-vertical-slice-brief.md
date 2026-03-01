# UE5 Vertical Slice Brief

## Purpose
Build a premium office simulation layer for Second Space in Unreal Engine 5 that makes the agent workforce feel alive, spatial, and legible without changing the existing backend or orchestration model.

This is not a realistic office sim and not a direct copy of any Nintendo property. The target is a stylized, cozy, high-fidelity life-sim office with blocky/chibi agents that preserve the current Minecraft-inspired identity.

## Related Docs
- [UE5 Art Bible](./ue5-art-bible.md)
- [UE5 Moodboard and Reference Board](./ue5-moodboard-reference-board.md)
- [UE5 Office Floor Plan](./ue5-office-floor-plan.md)
- [UE5 Integration Spec](./ue5-integration-spec.md)
- [Proposed API: `GET /api/presentation/workspace-scene`](./ue5-presentation-workspace-scene-api.md)
- [Workspace Scene Implementation Plan](./workspace-scene-implementation-plan.md)
- [UE5 Asset Production Checklist](./ue5-asset-production-checklist.md)
- [UE5 Sprint 0 Kickoff](./ue5-sprint-0-kickoff.md)
- [UE5 Sprint 0 Task Board](./ue5-sprint-0-task-board.md)
- [UE5 Sprint 0 Backlog](./ue5-sprint-0-backlog.md)
- [UE5 Sprint 0 GitHub Issue Pack](./ue5-sprint-0-github-issues.md)
- [UE5 Project Structure and Naming Conventions](./ue5-project-structure.md)

## Outcome
Deliver one production-quality vertical slice that proves:
- the office can feel premium and readable
- the agents can look charming and high-definition
- live workspace state can drive agent movement and status
- the current product architecture can remain the system of record

## Creative Direction

### Visual target
- Isometric or near-isometric office view
- Warm oak and birch woods
- Pale concrete and frosted glass
- Soft fabric accents
- Rounded furniture edges
- Premium toy-like materials
- Gentle bounce in animation
- Clean, stylized faces
- Blocky silhouettes with beveled edges

### Character direction
- Preserve Minecraft influence in silhouette only
- Shift from hard voxel look to beveled block/chibi look
- Large head, compact torso, short limbs
- Simple face, oversized eyes, minimal mouth
- Hair is chunky sculpted geometry or cards, not realistic strands
- One shared base body with role-driven variants

### Environment direction
- Office should feel like a cozy diorama
- Clear zones for PM, tech lead, engineering pods, meeting room, waiting area, and break area
- Layout should be readable from a fixed camera without UI overload

## Design Rules
- Do not pursue realism
- Do not use noisy textures
- Do not use complex facial rigs in phase 1
- Do not build a giant office before the slice works
- Keep shapes simple and materials polished
- Favor readability over decoration

## Scope of the First Vertical Slice

### Included
- 1 office floor
- 1 meeting room
- 1 PM/director zone
- 2 engineering pod zones
- 1 waiting area
- 1 break/lounge area
- 6 to 10 visible agents using one shared skeleton
- Floating selection/status markers
- Live movement driven by current agent state data

### Excluded
- Open-world navigation
- Photoreal rendering
- Full voice embodied avatars
- Lip sync
- Cinematic storytelling systems
- Complex NPC conversation inside UE

## Current Product Constraints
Second Space already has the right backend primitives. The UE client should use them instead of inventing a parallel world model.

### Current source-of-truth services
- `apps/web`
- `apps/worker`
- `PostgreSQL`
- `Redis`

### Current relevant APIs and realtime contracts
- `GET /api/agents`
- `GET /api/tasks`
- `GET /api/feed`
- `GET /api/sim/snapshot`
- `GET /api/integrations`
- `GET /api/workspace`
- Realtime:
  - `sim.agent.position.updated`
  - `sim.agent.state.updated`
  - `task.created`
  - `task.updated`
  - `approval.requested`
  - `approval.resolved`
  - `feed.event`
  - `security.hold.placed`
  - `security.hold.released`

### Current office waypoint model
The UE office should map cleanly to the existing waypoint graph in `packages/sim-engine/src/office.ts`:
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

The vertical slice should preserve those semantic waypoints even if the final art layout shifts visually.

## Recommended Architecture
Keep the web app as the system of record. UE5 should be a presentation client.

### Model
1. Second Space backend owns:
   - agent identity
   - task status
   - agent state
   - sim positions
   - approvals and holds
2. UE5 consumes that state and renders:
   - office scene
   - character placement
   - movement and animation
   - room occupancy
   - selected agent context

### Recommended delivery path
Phase 1:
- Build the UE5 vertical slice locally
- Validate art direction and state sync

Phase 2 decision:
- `Pixel Streaming` if this becomes a core live workspace mode
- or keep UE as a premium demo/look-dev layer and mirror the style back into the web renderer

Do not decide Pixel Streaming before the slice is approved.

## UE5 Technical Specification

### Engine features
- `Lumen` for GI and reflections
- `Virtual Shadow Maps`
- `Nanite` for environment assets where useful
- `Control Rig`
- `Animation Blueprint`
- `UMG` for overlay markers and room labels
- `Enhanced Input`

### Camera
- Fixed isometric or near-isometric angle
- No free-fly camera in the slice
- Optional slow pan/parallax only
- Office must read clearly at one stable zoom level

### Lighting
- Warm directional sunlight
- Soft skylight
- Local fill lights around desks and meeting room
- Slight color contrast between work zone and lounge zone
- Low bloom, soft contrast, slightly lifted saturation

### Materials
Create three master material families:
- character skin/clothing
- hair/accessories
- environment surfaces

Use material instances for role variation.

### Character rig and animation
Shared skeleton with these states:
- `IDLE`
- `MOVING`
- `WORKING`
- `MEETING`
- `BLOCKED`

Minimum animation set:
- idle loop
- walk loop
- typing/working loop
- meeting/listening loop
- blocked/frustrated loop
- selected reaction

### UI inside UE scene
Minimum overlays:
- selected agent highlight
- floating agent badge
- room label chips
- meeting/status pill

Keep the overlay layer sparse. The scene should remain the primary read.

## Asset Checklist

### Characters
- 1 base agent body
- 1 shared skeleton
- 4 hair variants
- 6 outfit colorways
- 3 role accessory packs
- 5 face states

### Environment
- desk module
- chair module
- monitor module
- shelf/cabinet module
- meeting table
- glass wall module
- office door
- lounge pouf
- planter
- rug
- side table
- desk lamp
- waste bin

### Presentation assets
- room signage kit
- badge icon kit
- selected-agent ring/highlight
- state indicator set

## Scene Layout Spec
The slice should include these functional zones:

### PM / leadership zone
- near the top-left or top-center of the map
- more private and slightly elevated visually
- connected to the meeting room

### Meeting room
- glass-enclosed
- visible from the main floor
- should read clearly even at a zoomed-out camera

### Engineering pods
- at least two clusters of desks
- enough visual density to imply active teamwork

### Waiting / blocked area
- visually separate from active work zones
- subtle, not punitive

### Break area
- softer materials
- lounge furniture
- visually warmer

## Data Integration Spec

### Inputs from current platform
At minimum, the UE client needs:
- workspace id
- agent id
- agent name
- agent role / specialist role
- agent state
- sim x/y
- selected agent id
- high-signal task state

### Mapping rules
- `IDLE` -> ambient posture in assigned zone
- `MOVING` -> walk to next waypoint
- `WORKING` -> desk animation
- `MEETING` -> meeting room occupancy
- `BLOCKED` -> waiting area or stalled posture

### Non-goals
The UE client should not:
- invent task state
- own approvals
- own orchestration logic
- own integration setup state
- replace the chat backend

## Team and Roles

### Lean setup
- 1 stylized 3D generalist
- 1 UE engineer
- 1 product/design lead

### Preferred setup
- 1 stylized character artist
- 1 environment artist
- 1 technical artist/animator
- 1 UE engineer
- 1 product/design lead

## Production Schedule

### Week 1
- style bible
- office floor plan
- camera and lighting target boards

### Week 2
- hero agent model
- base materials

### Week 3
- rig and animation blueprint
- idle/walk/work/meeting/blocked states

### Week 4
- office environment kit
- meeting room + desk pod + lounge

### Week 5
- lighting and post-process polish
- first approved visual captures

### Week 6
- overlay UI and scene interactivity
- click/select/highlight

### Week 7
- backend data hookup to current APIs/events

### Week 8
- agent variants and scene polish

### Week 9
- performance, bug fixing, usability pass

### Week 10
- review and delivery decision on Pixel Streaming vs non-streamed use

## Risks

### Risk: overbuilding art before interaction is proven
Mitigation:
- vertical slice only
- one room cluster first

### Risk: realistic rendering drifts away from brand
Mitigation:
- lock style bible early
- enforce stylized material rules

### Risk: UE integration replaces too much of the app
Mitigation:
- backend remains source of truth
- UE is presentation-only in phase 1

### Risk: Pixel Streaming complexity too early
Mitigation:
- defer streaming decision until slice approval

## Definition of Done for the Vertical Slice
The slice is successful only if:
- one office scene feels premium and readable
- at least six agents feel alive and distinct
- the current backend can drive visible state changes
- the office zones map clearly to real agent behavior
- the art style feels consistent with Second Space
- the result looks like a product feature, not a rendering test

## Immediate Next Steps
1. Produce a one-page art bible with:
   - color palette
   - character proportions
   - material examples
   - camera reference
2. Create a top-down office floor plan aligned to current waypoints
3. Build one hero agent and one office corner in UE5
4. Review screenshots before building the full slice

## Decision Gate After First Review
After the first hero-agent plus office-corner review, decide one of:
- proceed with full vertical slice in UE5
- keep UE for look-dev only and port the style back to the web app
- pause the UE path if it does not materially improve the product
