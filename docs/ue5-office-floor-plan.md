# UE5 Office Floor Plan

## Purpose
Map the current waypoint graph in `/Users/charlesacquah-davis/Code/second-space/packages/sim-engine/src/office.ts` into a real UE5 office layout so environment art, animation, and integration all share the same spatial model.

## Constraint
This is a first-pass production floor plan. It is anchored to the current waypoint coordinates and semantics, not to the aspirational reference compositions.

That means:
- the layout must work with the current sim today
- visual polish can improve later
- if the art team wants a materially different room arrangement, the waypoint graph should be versioned and updated explicitly rather than drifting silently

## Current Waypoints

| Waypoint | X | Y | Meaning |
|---|---:|---:|---|
| `lobby` | 120 | 120 | entry / arrival / cancelled fallback |
| `directorDesk` | 260 | 110 | PM / leadership anchor |
| `managerDeskA` | 320 | 200 | manager review / approvals anchor |
| `managerDeskB` | 240 | 230 | secondary manager coordination anchor |
| `specialistPodA` | 390 | 280 | primary active work pod |
| `specialistPodB` | 455 | 260 | secondary active work pod |
| `meetingRoom` | 170 | 300 | queued / assigned discussion zone |
| `waitingArea` | 90 | 280 | blocked / failed holding zone |
| `breakArea` | 510 | 160 | done / recovery / ambient lounge |

## Coordinate Interpretation
For the first-pass plan:
- lower `x` = farther west / left
- higher `x` = farther east / right
- lower `y` = farther north / top
- higher `y` = farther south / bottom

This yields a workspace with:
- entry on the north-west
- PM near north-center
- approvals/management in the central spine
- engineering work pods on the east/south-east
- meeting room on the south-west
- waiting area on the west/south-west edge
- lounge on the north-east

## Planning Rule
Do not relocate a zone because it looks nicer in isolation. If a zone moves, the waypoint semantics in `packages/sim-engine` must move with it.

## Zone Plan

### 1. Lobby
- Waypoint: `lobby`
- Coordinates: `120, 120`
- Placement: north-west entry edge
- Function:
  - arrival
  - idle fallback
  - cancelled-task fallback
- Environment notes:
  - small entrance threshold
  - no heavy hero geometry
  - visually open to the rest of the office

### 2. PM / Director Zone
- Waypoint: `directorDesk`
- Coordinates: `260, 110`
- Placement: north-center
- Function:
  - PM anchor
  - leadership visibility over the floor
- Environment notes:
  - one premium leadership desk cluster
  - lightly elevated or visually distinct through materials, not physical stairs
  - line of sight toward both management and engineering zones

### 3. Manager Review Spine
- Waypoints:
  - `managerDeskA`
  - `managerDeskB`
- Coordinates:
  - `320, 200`
  - `240, 230`
- Placement: central coordination band
- Function:
  - reviews
  - approvals
  - handoff coordination
- Environment notes:
  - this should feel like a management corridor between PM and specialists
  - use two desk clusters or one paired review island

### 4. Engineering Pod A
- Waypoint: `specialistPodA`
- Coordinates: `390, 280`
- Placement: east / south-east
- Function:
  - primary in-progress work zone
- Environment notes:
  - dense desk cluster
  - this is the main “work is happening” area

### 5. Engineering Pod B
- Waypoint: `specialistPodB`
- Coordinates: `455, 260`
- Placement: far east / south-east
- Function:
  - secondary specialist work zone
- Environment notes:
  - should feel adjacent to Pod A, not isolated
  - enough separation for occupancy reading

### 6. Meeting Room
- Waypoint: `meetingRoom`
- Coordinates: `170, 300`
- Placement: south-west quadrant
- Function:
  - queued / assigned pre-work conversations
  - visible group activity
- Environment notes:
  - glass-enclosed
  - readable from the main camera
  - should not dominate the full office

### 7. Waiting / Blocked Area
- Waypoint: `waitingArea`
- Coordinates: `90, 280`
- Placement: west / south-west edge
- Function:
  - blocked tasks
  - failed-task holding behavior
- Environment notes:
  - visually distinct from active work
  - not punitive or gloomy
  - use softer seating or a side bay, not a “penalty box”

### 8. Break / Lounge Area
- Waypoint: `breakArea`
- Coordinates: `510, 160`
- Placement: north-east
- Function:
  - done-task cooldown
  - ambient life
- Environment notes:
  - soft furniture
  - warmer lighting
  - visually lighter than work pods

## Adjacency Rules

### Must be adjacent or visually connected
- `lobby` <-> `directorDesk`
- `directorDesk` <-> `managerDeskA`
- `managerDeskA` <-> `managerDeskB`
- `managerDeskA` <-> `specialistPodA`
- `specialistPodA` <-> `specialistPodB`
- `meetingRoom` <-> `managerDeskB`
- `waitingArea` <-> `meetingRoom`

### Must be visually separate
- `waitingArea` from `breakArea`
- `breakArea` from `meetingRoom`
- `directorDesk` from `specialistPodB`

## Movement Corridors
The layout must support these readable movement lines:
- lobby -> directorDesk
- directorDesk -> manager desks
- manager desks -> specialist pods
- manager desks -> meetingRoom
- meetingRoom -> waitingArea
- specialist pods -> breakArea

Do not block these with decorative props.

## First-Pass Top-Down Layout

```text
NORTH / TOP

┌──────────────────────────────────────────────────────────────────────┐
│ Lobby / Entry      PM / Director Desk            Break / Lounge     │
│ (lobby)            (directorDesk)                (breakArea)        │
│                                                                      │
│                                                                      │
│                   Manager Review Spine                               │
│                   (managerDeskA + managerDeskB)                      │
│                                                                      │
│ Waiting / Blocked   Glass Meeting Room      Specialist Pod A         │
│ (waitingArea)       (meetingRoom)           (specialistPodA)         │
│                                              Specialist Pod B        │
│                                              (specialistPodB)        │
└──────────────────────────────────────────────────────────────────────┘

SOUTH / BOTTOM
```

## Camera Recommendation
For this waypoint arrangement:
- camera should favor north-west to south-east readability
- PM, management, and lounge should all stay in the upper half of frame
- meeting room and waiting area should remain readable without pushing the pods off-screen

## Layout Tradeoff
This waypoint geometry does not naturally place the meeting room in the upper-left hero spot common in some reference scenes.

That is acceptable for phase 1.

If the product later needs a more reference-faithful composition, create:
- `office layout v2`
- updated waypoint graph
- migration plan for worker/sim mapping

Do not fake the layout in art while leaving the old coordinates underneath.

## UE Blocking Instructions

### Blocking pass order
1. floor plate
2. lobby threshold
3. PM desk zone
4. manager review island
5. glass meeting room
6. waiting area
7. specialist pods
8. lounge zone
9. circulation clearances

### Blocking quality bar
- every zone must read from the locked camera
- every movement corridor must be visually plausible
- blocked and done states must be readable by location alone

## Definition of Done
This floor plan is usable when:
- every current waypoint has one unambiguous UE zone
- the office reads clearly from a fixed camera
- there are no contradictory room semantics
- art and engineering can build from the same spatial assumptions
