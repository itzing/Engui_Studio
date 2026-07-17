---
id: ENGUI-399
title: Add seeded brace prompt variants
status: Done
assignee: []
created_date: '2026-07-17 13:59'
updated_date: '2026-07-17 14:07'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Support prompt variant groups like `{4k UHD footage|iphone video from 2000s}` by selecting exactly one option from each group before submitting generation. Selection must be deterministic from the generation seed so the same seed and prompt reproduce the same resolved prompt.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Desktop and mobile Create prompts resolve `{a|b|c}` groups before model submit.
- [x] #2 Video Sequence segment generation resolves variant groups before model submit.
- [x] #3 Selection is deterministic for the same seed and prompt, including multiple groups in one prompt.
- [x] #4 Focused tests cover seeded resolution and submit payload behavior without launching live RunPod jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Use a shared resolver close to generation submission, after seed selection is known and before secure payload construction.

Implemented a shared server-side prompt variant resolver in the generation submit path. It selects one option from each `{a|b|c}` group using the final generation seed, stores the original template and resolved prompt in job options when expansion happens, and returns the resolved prompt/seed to Create UI clients.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Seeded brace prompt variants now resolve before RunPod submission for Create and Video Sequence generation flows. The same seed and prompt template reproduce the same expanded prompt.
<!-- SECTION:FINAL_SUMMARY:END -->
