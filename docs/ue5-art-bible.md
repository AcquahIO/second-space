# UE5 Art Bible

## Project Statement
Second Space should feel like a premium, cozy, isometric agent office where a founder can watch an AI team think, move, meet, and work. The office should feel alive and aspirational, while the agents remain simple, charming, and instantly readable.

## Related Docs
- [UE5 Moodboard and Reference Board](./ue5-moodboard-reference-board.md)
- [UE5 Office Floor Plan](./ue5-office-floor-plan.md)
- [UE5 Vertical Slice Brief](./ue5-vertical-slice-brief.md)

## North Star
Build a stylized life-sim office with high-fidelity materials and lighting, but keep the characters blocky/chibi so they stay true to the current product identity.

## Core Style Pillars
- Cozy
- Premium
- Readable
- Playful
- Calm
- Spatial

## Anti-Pillars
- Photoreal
- Gritty
- Noisy
- Overdesigned
- Cyberpunk
- Generic game HUD

## Visual Formula
- Simple geometry
- Soft, expensive-looking materials
- Warm daylight
- Frosted glass
- Rounded furniture
- Large-head, short-limb characters
- Clear room zoning
- Minimal but polished overlay UI

## Character Direction

### Silhouette
- Preserve Minecraft influence in the broad silhouette only
- Shift to beveled blocks instead of hard cubes
- Large head, compact torso, short limbs
- Hands stay simplified
- Eyes should read from distance

### Face
- Large eyes
- Minimal mouth
- Minimal nose or no nose
- Expressions should be readable with tiny changes

### Hair
- Chunky stylized shapes
- Clean silhouette first, detail second
- Avoid realistic strands in phase 1

### Surface finish
- Matte-to-satin materials
- Soft specular response
- No skin pores, fabric noise, or dirt passes

## Environment Direction

### Mood
- Warm, calm, optimistic work environment
- Feels like a creative studio crossed with a polished simulation toy set

### Space language
- Open desk pods
- Glass meeting room
- Lounge/break zone
- PM/leadership zone
- Soft transitions between zones

### Forms
- Straight lines for layout
- Rounded corners on furniture and props
- Large clean surfaces
- Sparse, curated props

## Color Palette

### Base neutrals
- Soft ivory: `#F7F3EC`
- Warm birch: `#E3CFAD`
- Pale oak: `#D8B07C`
- Light concrete: `#D8D1C5`
- Frosted white: `#F3F5F8`
- Ink slate: `#2D3340`

### Product accents
- PM blue: `#6FA5FF`
- Engineering blue: `#5C96E1`
- Success green: `#67D88D`
- Meeting gold: `#F1C768`
- Blocked coral: `#F07C84`
- Soft violet glow: `#D5B8FF`

### Usage rule
- 70% warm neutrals
- 20% cool structural accents
- 10% status/UI highlights

## Material Rules

### Environment
- Wood: clean grain, low-frequency detail, warm highlight
- Concrete: soft and pale, not industrial/grimy
- Glass: frosted/translucent, slightly dreamy
- Fabric: matte, minimal weave detail
- Metal: soft powder-coated, not shiny chrome

### Characters
- Skin: soft, even tone, very light subsurface feel
- Clothing: matte with subtle sheen
- Hair: stylized blocks/cards with clean value separation
- Accessories: simple and iconic

## Camera Rules
- Fixed isometric or near-isometric view
- Camera should feel stable and intentional
- No free camera in the core workspace view
- Scene must read clearly without user rotation

## Lighting Rules
- Warm daylight key light
- Soft skylight fill
- Gentle color separation between work zones and lounge zones
- Clean shadows, no harsh contrast
- Slight dreaminess, not bloom-heavy fantasy

## Animation Rules
- Slightly exaggerated motion
- Characters should always feel alive
- Idle loops need subtle breathing and posture shifts
- Walks need bounce and readability
- Meeting loops need listening/nodding behavior
- Blocked state needs a small readable frustration beat

## UI Overlay Rules
- Use glassy floating chips, not heavy panels
- Keep overlays sparse
- Show only the information needed to read the room:
  - selected agent
  - room labels
  - current meeting/status
  - state markers

## Character Proportions
- Head: 38% to 44% of total height
- Torso: 24% to 28%
- Legs: 24% to 28%
- Arms: short and simplified

## Asset Quality Bar
- Every asset must look good from the locked camera first
- Small detail that does not read at camera distance is wasted effort
- Better materials and lighting beat more geometry

## Acceptance Test
The style is correct if:
- a screenshot reads as a charming office simulation immediately
- the agents still feel like Second Space agents
- the scene feels warm and premium, not sterile or gamey
- the user can identify where people are and what they are doing at a glance
