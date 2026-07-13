---
id: ENGUI-393
title: Expand WAN22 I2V Prompt Helper abstract actions into concrete choreography
status: Done
assignee: []
created_date: '2026-07-13 11:30'
updated_date: '2026-07-13 11:34'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 image-to-video Prompt Helper still returns passthrough-style output for abstract action prompts such as 'prominent seductive dance movements'. Tune the helper so short action phrases are expanded into observable body movement details, while keeping source image continuity and positive do-this wording.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Short abstract action phrases are expanded into concrete body movement, gesture, weight shift, expression, and timing details.
- [x] #2 Dance-oriented instructions mention specific choreography/body mechanics instead of repeating the source phrase as the main prompt.
- [x] #3 Source-image-aware instructions carry the same concrete motion expansion rule for desktop and mobile Create Video flows.
- [x] #4 Focused tests cover the concrete choreography prompt contract without live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Updated the WAN22 video Prompt Helper contract so short abstract action phrases are transformed into concrete observable choreography. Added dance-specific guidance for hips, torso, shoulders, hands/arms, head direction, expression, step rhythm, weight transfer, and motion timing. Mirrored the concrete choreography rule in the source-image-aware Create Video instruction used by desktop and mobile flows. Kept WAN22 helper wording positive, with no Do not/Avoid constraints in the I2V system/user prompt rules.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 I2V Prompt Helper now expands prompts such as 'prominent seductive dance movements' into concrete body mechanics instead of passing through the phrase. Focused provider and video form tests cover the concrete choreography prompt contract.
<!-- SECTION:FINAL_SUMMARY:END -->
