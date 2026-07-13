---
id: ENGUI-395
title: Set WAN22 video Prompt Helper temperature to 0.4
status: Done
assignee: []
created_date: '2026-07-13 12:27'
updated_date: '2026-07-13 12:29'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN22 video Prompt Helper currently uses the same low text-helper sampling temperature as the default image helper. Raise only the WAN22 video helper profile to 0.4 so motion/choreography rewrites are less repetitive while preserving stable default image helper behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 wan22-video Prompt Helper requests send temperature 0.4 to the local provider.
- [x] #2 Default image Prompt Helper requests keep the existing low temperature.
- [x] #3 Focused provider tests cover both profile temperatures.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added profile-specific Prompt Helper temperature selection in src/lib/promptHelper/localProvider.ts. Default image helper requests remain at 0.1, while wan22-video requests now send temperature 0.4 to the local OpenAI-compatible chat completion provider. Focused provider tests cover both temperatures.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
WAN22 video Prompt Helper now uses temperature 0.4 for less repetitive video motion rewrites while default image helper behavior stays at 0.1.
<!-- SECTION:FINAL_SUMMARY:END -->
