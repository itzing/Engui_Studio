---
id: ENGUI-392
title: Make WAN22 I2V Prompt Helper honor explicit pose and action changes
status: Done
assignee: []
created_date: '2026-07-13 11:00'
updated_date: '2026-07-13 11:04'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The WAN22 image-to-video Prompt Helper currently over-anchors source pose and collapses explicit actions such as dance into conservative micro-motion. Tune the helper prompt so explicit user action commands become the primary motion beat while source image details remain visual continuity.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Explicit action or pose-change commands become the primary motion beat.
- [x] #2 Micro-motion is framed as supporting detail for explicit actions and a default for vague animation requests.
- [x] #3 System and user prompts express rules in positive do-this language rather than long negative constraint lists.
- [x] #4 Focused tests cover the WAN22 I2V helper prompt and source-image instruction behavior.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the shared WAN22 image-to-video Prompt Helper prompt to prioritize explicit user action, pose-change, gesture, expression, and camera-change instructions as the main motion beat. Reframed micro-motion as support for explicit actions and as the main beat only for vague animation requests. Updated the source-image-aware video instruction with the same positive action-first rules.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 I2V Prompt Helper now treats commands such as dance, walk, run, sit, kneel, turn around, and change pose as intentional primary motion beats, while keeping source image identity and framing continuous by default. Focused provider and video form tests cover the new prompt contract.
<!-- SECTION:FINAL_SUMMARY:END -->
