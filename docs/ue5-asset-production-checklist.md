# UE5 Asset Production Checklist

## Use
This checklist is the production-facing asset list for the first UE5 vertical slice. It is intentionally scoped for one office floor and one reusable agent system.

## Character System
- [ ] Finalize base character proportions
- [ ] Approve one hero agent silhouette
- [ ] Build one base body mesh
- [ ] Build one shared skeleton
- [ ] Create base skin material
- [ ] Create base clothing material
- [ ] Create base hair material
- [ ] Build 4 hair variants
- [ ] Build 3 accessory sets
- [ ] Build 6 outfit colorways
- [ ] Create simple face set: neutral, happy, focused, thinking, blocked
- [ ] Create selected-agent highlight effect

## Character Animation
- [ ] Idle loop
- [ ] Walk loop
- [ ] Working at desk loop
- [ ] Meeting/listening loop
- [ ] Blocked/frustrated loop
- [ ] Selected/focus reaction
- [ ] Animation blueprint with state switching
- [ ] Validate loops from locked camera distance

## Environment Kit
- [ ] Desk module
- [ ] Chair module
- [ ] Monitor module
- [ ] Keyboard/mouse desk detail set
- [ ] Shelf/cabinet module
- [ ] Glass wall module
- [ ] Door module
- [ ] Meeting table
- [ ] Lounge pouf
- [ ] Rug
- [ ] Planter
- [ ] Waste bin
- [ ] Side table
- [ ] Desk lamp

## Office Zones
- [ ] PM/leadership zone
- [ ] Meeting room
- [ ] Engineering pod A
- [ ] Engineering pod B
- [ ] Waiting/blocked area
- [ ] Break/lounge area

## Materials
- [ ] Environment master material
- [ ] Character master material
- [ ] Hair/accessory master material
- [ ] Wood material instances
- [ ] Concrete material instance
- [ ] Frosted glass material instance
- [ ] Fabric material instance
- [ ] UI glass material/look treatment

## Scene Presentation
- [ ] Locked camera angle
- [ ] Base daylight lighting pass
- [ ] Accent/fill lighting pass
- [ ] Post-process pass
- [ ] Floating agent badge system
- [ ] Room label chip system
- [ ] Top status pill
- [ ] Selected-agent focus behavior

## Tech Setup
- [ ] UE5 project created
- [ ] Naming conventions defined
- [ ] Folder structure defined
- [ ] Data assets for agent archetypes
- [ ] Data assets for room definitions
- [ ] Scene controller blueprint or C++ class
- [ ] API bootstrap service
- [ ] Realtime event listener
- [ ] Actor-to-agent id mapping

## Backend Mapping Validation
- [ ] `GET /api/agents` wired
- [ ] `GET /api/sim/snapshot` wired
- [ ] `GET /api/tasks` wired
- [ ] `GET /api/feed` wired
- [ ] `GET /api/integrations` wired
- [ ] `sim.agent.position.updated` applied
- [ ] `sim.agent.state.updated` applied
- [ ] task/approval events trigger refresh

## Quality Gates
- [ ] Scene reads clearly from one screenshot
- [ ] Agents remain recognizable as Second Space agents
- [ ] No photoreal drift
- [ ] No dead empty areas in the office
- [ ] Blocked state is readable
- [ ] Meeting occupancy is readable
- [ ] Character faces are readable at camera distance
- [ ] Materials feel premium, not noisy

## Performance Gates
- [ ] Stable frame rate on target dev hardware
- [ ] No obvious hitching on realtime updates
- [ ] Lighting cost acceptable
- [ ] UI overlays remain legible and cheap

## Review Gates
- [ ] Hero character review approved
- [ ] Office corner review approved
- [ ] Lighting review approved
- [ ] Backend sync review approved
- [ ] Full vertical slice review approved
