---
id: ENGUI-504
title: Persist video parameter edits immediately
status: Done
assignee: []
created_date: '2026-08-18 06:46'
labels:
  - create-video
  - mobile
  - drafts
  - t2v
  - bug
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
T2V mobile should save draft parameters at parameter-change time, matching I2V/image behavior, instead of relying on delayed autosave or unmount flush.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Changing a WAN22 T2V parameter writes the updated video draft synchronously.
- [x] #2 Returning to mobile Create after Jobs restores the edited T2V parameters.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Focused regression test covers immediate parameter persistence.
<!-- DOD:END -->

## Result

- Video parameter changes now save the video draft synchronously from the change handler.
- WAN LoRA weight snapshots prefer the just-edited value, so immediate persistence does not lag behind the dedicated weight state.
- Added regression coverage that reads draft storage immediately after changing a WAN22 T2V width parameter.
