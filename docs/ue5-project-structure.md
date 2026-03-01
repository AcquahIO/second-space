# UE5 Project Structure and Naming Conventions

## Purpose
Define the first-pass Unreal Engine 5 folder structure and asset naming system for the Second Space vertical slice.

This exists to stop Sprint 0 from turning into an unstructured asset dump.

## Rules
- Keep one clear home for each asset family.
- Prefer reusable base assets over duplicate variations.
- Keep names readable from the Content Browser without opening the asset.
- Use consistent prefixes. Do not invent new ones per artist.

## Root Content Layout
Recommended UE project content root:

```text
Content/
  SecondSpace/
    Core/
    Characters/
    Environment/
    Materials/
    UI/
    Animation/
    Data/
    Audio/
    Maps/
    Dev/
```

## Folder Breakdown

### `Content/SecondSpace/Core`
Use for:
- shared blueprint utilities
- common gameplay helpers
- shared interaction actors
- common scene markers

Examples:
- selection logic
- waypoint anchor actors
- reusable interaction components

### `Content/SecondSpace/Characters`
Use for:
- base agent meshes
- role variants
- skeletons
- hair meshes
- outfit meshes
- character blueprints

Suggested structure:

```text
Characters/
  Base/
  ProjectManager/
  TechLead/
  Engineering/
  QA/
  DevOps/
  Security/
  Shared/
```

### `Content/SecondSpace/Environment`
Use for:
- office architecture
- desk kits
- props
- room kits
- modular layout pieces

Suggested structure:

```text
Environment/
  Architecture/
  Furniture/
  Props/
  MeetingRoom/
  Lounge/
  Signage/
```

### `Content/SecondSpace/Materials`
Use for:
- master materials
- material instances
- shared texture sets

Suggested structure:

```text
Materials/
  Masters/
  Instances/
  Functions/
  Textures/
```

### `Content/SecondSpace/UI`
Use for:
- floating badges
- room labels
- overlay widgets
- selection widgets

### `Content/SecondSpace/Animation`
Use for:
- animation sequences
- animation blueprints
- blend spaces
- control rigs
- IK rigs

### `Content/SecondSpace/Data`
Use for:
- data assets
- agent archetypes
- room metadata
- scene config
- waypoint mapping data

### `Content/SecondSpace/Audio`
Use for:
- ambience
- UI sounds
- interaction cues

### `Content/SecondSpace/Maps`
Use for:
- persistent office map
- lighting test map
- blockout map

### `Content/SecondSpace/Dev`
Use for:
- temporary prototypes
- throwaway experiments
- debug widgets

Rule:
- nothing ships from `Dev`
- successful prototypes must be moved into the main structure

## Naming Prefixes

### Blueprints
- `BP_` for actor and gameplay blueprints
- `WBP_` for widget blueprints

Examples:
- `BP_AgentCharacter`
- `BP_WaypointAnchor`
- `WBP_AgentBadge`

### Static Meshes
- `SM_`

Examples:
- `SM_Desk_01`
- `SM_GlassWall_Short`
- `SM_LoungePouf_A`

### Skeletal Meshes
- `SK_`

Examples:
- `SK_AgentBase`
- `SK_Agent_PM`

### Skeletons
- `SKEL_`

Examples:
- `SKEL_AgentBase`

### Materials
- `M_` for master materials
- `MI_` for material instances
- `MF_` for material functions

Examples:
- `M_CharacterSurface`
- `MI_Character_PM_OutfitA`
- `M_OfficeSurface`

### Textures
- `T_`

Examples:
- `T_DeskWood_Albedo`
- `T_DeskWood_Normal`

### Animation
- `AN_` for animation sequences
- `ABP_` for animation blueprints
- `BS_` for blend spaces
- `CR_` for control rigs
- `IKR_` for IK rigs

Examples:
- `AN_Agent_Idle`
- `AN_Agent_Walk`
- `ABP_AgentBase`
- `CR_AgentBase`

### Data Assets and Data Tables
- `DA_` for data assets
- `DT_` for data tables

Examples:
- `DA_AgentArchetype_PM`
- `DA_RoomProfile_MeetingRoom`
- `DT_WaypointMap`

### Maps
- `LV_`

Examples:
- `LV_OfficeSlice`
- `LV_LightingTest`

## Character Naming Rules
- One shared base body should remain canonical.
- Role variants should be expressed as child assets or clearly named derivatives.
- Avoid duplicate skeletons unless a hard technical reason exists.

Recommended pattern:
- `SK_AgentBase`
- `BP_AgentBase`
- `MI_Agent_PM_OutfitA`
- `MI_Agent_TechLead_OutfitA`

## Environment Naming Rules
- Name by object first, variant second.
- Do not use names like `mesh_final_v2`.
- Use semantic identifiers, not artist-local shorthand.

Good:
- `SM_DeskPod_Double`
- `SM_GlassPartition_Corner`
- `SM_MeetingTable_Round`

Bad:
- `SM_TestThing`
- `SM_Desk_New`
- `SM_OfficeFinal2`

## Scene and Map Rules
- Keep one primary slice map for review.
- Keep one separate lighting test map.
- Keep experimental geometry out of the review map unless approved.

Recommended maps:
- `LV_OfficeSlice`
- `LV_OfficeBlockout`
- `LV_LightingValidation`

## Data and Integration Naming
Waypoint and backend-facing scene assets should follow the same semantic zone names already used by the sim:
- `lobby`
- `directorDesk`
- `managerDeskA`
- `managerDeskB`
- `specialistPodA`
- `specialistPodB`
- `meetingRoom`
- `waitingArea`
- `breakArea`

Recommended asset/data examples:
- `DA_RoomProfile_DirectorDesk`
- `BP_WaypointAnchor_MeetingRoom`
- `DA_WaypointMap_OfficeSlice`

## Source Control Rules
- Do not commit throwaway imports directly into the final folder structure.
- Keep blockout assets separated from final assets.
- Move approved assets out of `Dev` before review signoff.

## Review Gate
Sprint 0 folder setup is acceptable when:
- a new artist can place assets without asking where they go
- naming is predictable across characters, environment, animation, and UI
- waypoint-linked assets map cleanly to the current sim semantics
