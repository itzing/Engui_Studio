---
id: ENGUI-396
title: Add WAN22 video prompt clear and Empty prompt helper option
status: Done
assignee: []
created_date: '2026-07-13 12:52'
updated_date: '2026-07-13 12:59'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 Create Video needs parity with image prompt quick clear and a Prompt Helper option to start from an empty prompt. Add a quick clear control to the video prompt field, and add an Empty prompt checkbox next to the Prompt Helper magic wand. When Empty prompt is checked and the user invokes Prompt Helper, clear the prompt before the helper request so the helper runs without the current prompt text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 WAN22 Create Video prompt has a quick clear button matching the existing image prompt behavior.
- [x] #2 Prompt Helper controls include an Empty prompt checkbox next to the magic wand on the shared desktop/mobile video form.
- [x] #3 When Empty prompt is checked, invoking Prompt Helper clears the prompt before calling the helper and sends an empty text prompt.
- [x] #4 Default behavior remains unchanged when Empty prompt is unchecked.
- [x] #5 Focused tests cover clear and Empty prompt helper behavior without live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added a shared desktop/mobile WAN22 Create Video prompt header with a Clear prompt icon action. Added an Empty prompt checkbox beside the saved Prompt Helper magic-wand action. When enabled, Prompt Helper calls clear the current prompt state and send an empty prompt payload to the wan22-video helper while preserving default behavior when unchecked. Added focused component tests for the clear action and empty-prompt helper request.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 Create Video now has quick prompt clearing and an Empty prompt Prompt Helper mode on the shared desktop/mobile form.
<!-- SECTION:FINAL_SUMMARY:END -->
