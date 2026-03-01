# UE5 Moodboard and Reference Board

## Purpose
This board format turns the art bible into something the team can gather and review quickly. It is not a random inspiration dump. Every reference must support a specific decision in the UE5 vertical slice.

## How to Use This Board
- Create one board section per category below
- Add `6` to `12` references per section
- Every reference must be tagged:
  - `KEEP`
  - `AVOID`
  - `MAYBE`
- Every reference must have a note explaining what is being referenced:
  - lighting
  - materials
  - proportions
  - composition
  - camera
  - motion
  - UI

## Board Rule
Do not collect references because they are popular or attractive in isolation. Collect them only if they solve one of these questions:
- How should the office feel?
- How should the agents read from a distance?
- How should the scene be lit?
- How should the room layout support the current sim waypoints?
- How should overlays sit on top of the scene without ruining it?

## Category 1: Overall World Mood

### Goal
Lock the emotional tone of the office.

### Gather
- isometric or near-isometric stylized interiors
- life-sim environments with calm, premium mood
- warm, daylight-driven studio or office spaces

### What to look for
- warm woods
- pale architectural surfaces
- quiet premium feeling
- soft indirect light
- clear room zoning

### Reject
- gritty realism
- cyberpunk/neon-heavy scenes
- cluttered rooms
- aggressive contrast

### Review question
Does this feel like a place where a founder would want to watch an agent team operate for hours?

## Category 2: Character Silhouette and Proportions

### Goal
Lock the shape language of the agents.

### Gather
- stylized chibi characters
- blocky or simplified characters
- toy-like figures with high readability
- stylized business or workplace characters

### What to look for
- large heads
- short limbs
- simple hands
- readable from distance
- soft/beveled geometry

### Reject
- realistic anatomy
- tiny heads
- over-detailed faces
- realistic body proportions

### Review question
Could the user identify an agent’s presence, stance, and role from the fixed office camera?

## Category 3: Face, Hair, and Expression

### Goal
Lock how expressive the characters should be without overbuilding facial systems.

### Gather
- stylized faces with minimal features
- chunky hair shapes
- expressive eyes
- subtle expression studies

### What to look for
- face readability at distance
- hair silhouette clarity
- simple emotional range
- low facial complexity

### Reject
- realistic pores
- cinematic facial rigs
- hair strand realism

### Review question
Does the face still work when the character is seen from office-camera distance instead of portrait distance?

## Category 4: Materials and Surface Finish

### Goal
Define what makes the scene feel premium.

### Gather
- wood material references
- soft concrete/plaster references
- frosted glass references
- matte plastic and powder-coated metal references
- stylized skin and cloth finish references

### What to look for
- low-frequency detail
- soft highlight response
- minimal noise
- clean value separation

### Reject
- grunge maps
- over-weathering
- sharp photoreal speculars
- complex microtexture dependence

### Review question
Would this material still look premium if the geometry stayed simple?

## Category 5: Office Layout and Zoning

### Goal
Gather spatial references that support the current Second Space waypoints.

### Gather
- desk pod layouts
- glass meeting rooms
- lounge zones
- reception/lobby layouts
- modular office furniture systems

### What to look for
- readable circulation paths
- visible meeting room
- clear desk clusters
- obvious leadership zone
- lounge separated from focused work

### Must map to current sim semantics
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

### Review question
Can this reference be adapted to the current waypoint model without breaking the sim?

## Category 6: Camera and Composition

### Goal
Lock how the world is framed.

### Gather
- isometric room shots
- top-down simulation views
- diorama compositions
- readable fixed-camera interiors

### What to look for
- one stable composition
- strong silhouettes
- readable depth
- clear room relationships

### Reject
- references that only work through cinematic closeups
- handheld or first-person framing
- layouts that require camera rotation to understand

### Review question
Does this composition still read when the user is mainly watching status and movement, not exploring?

## Category 7: Lighting and Color Script

### Goal
Lock the slice lighting model.

### Gather
- daylight interiors
- warm sun with soft bounce
- room-to-room light variation
- soft ambient fill references

### What to look for
- warm directional light
- soft skylight
- clear but not harsh shadows
- subtle mood separation between work and lounge areas

### Reject
- dark moody interiors
- heavy orange/teal grading
- neon color contamination
- hard contrast realism

### Review question
Does this feel premium and calm, not dramatic or gamey?

## Category 8: Overlay UI on Scene

### Goal
Define how labels, chips, and selection markers sit on top of the office.

### Gather
- floating markers
- glass UI chips
- spatial labels
- minimal scene HUD systems

### What to look for
- unobtrusive overlays
- good contrast without heavy panels
- legibility over bright and dark surfaces
- room labels and status pills that do not dominate the frame

### Reject
- mobile-game HUD clutter
- giant badges
- heavy boxed interfaces

### Review question
Does the overlay help the user read the room instead of covering the room?

## Category 9: Motion and Living-Office Feel

### Goal
Define how alive the office should feel.

### Gather
- subtle idle animation references
- stylized walk loops
- group meeting motion
- attention/focus state motion

### What to look for
- soft bounce
- readable state changes
- ambient life without chaos
- clean looping behavior

### Reject
- noisy random motion
- exaggerated slapstick
- robotic motion

### Review question
Would the scene still feel alive if the user watched it silently for 30 seconds?

## Category 10: Anti-Reference Board

### Goal
Make the no-go zones explicit.

### Gather
- photoreal office references that are too cold or corporate
- cluttered isometric scenes
- over-detailed anime/game characters
- cyberpunk or neon-heavy scenes
- realistic strand-hair closeup characters

### Use
Tag each anti-reference with why it is wrong:
- too realistic
- too noisy
- too dark
- too close-up dependent
- loses Second Space character identity

## Board Output Format

### Deliverable structure
- Section title
- 6 to 12 images
- short note under each image
- one summary line for the section:
  - `Keep because...`
  - `Avoid because...`

### Recommended section order
1. overall world mood
2. character silhouette
3. face/hair/expression
4. materials
5. office layout
6. camera
7. lighting
8. overlay UI
9. motion
10. anti-reference

## Review Checklist
- [ ] Every board section has a decision purpose
- [ ] Every image has a note, not just a thumbnail
- [ ] The board contains anti-references
- [ ] Character references still preserve Second Space identity
- [ ] Layout references can map to existing sim waypoints
- [ ] The board supports a fixed camera view
- [ ] The board does not drift into realism

## Final Review Question
If the board were handed to a 3D artist with no extra explanation, would they know how to build the correct Second Space UE5 slice?
