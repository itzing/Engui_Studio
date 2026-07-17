---
id: ENGUI-400
title: Preserve brace prompt templates in jobs and gallery
status: Done
assignee: []
created_date: '2026-07-17 23:47'
updated_date: '2026-07-17 23:52'
labels: []
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keep the user's original prompt template, including `{a|b|c}` variant groups, in persisted jobs and gallery generation snapshots while still sending the seed-resolved prompt to the model endpoint.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 RunPod secure payloads continue to receive the resolved prompt selected from the final seed.
- [x] #2 Job `prompt` and persisted generation options store the original prompt template when brace variants are used.
- [x] #3 Gallery assets created from job outputs preserve the original prompt template so gallery reuse to txt2img restores the full `{}` prompt.
- [x] #4 Focused tests cover secure submit persistence and gallery snapshot behavior without launching live jobs.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.

Implemented by keeping the original prompt template as the stored/API `prompt` while preserving the resolved prompt in `resolvedPrompt` metadata. The submit path still places the resolved prompt into the RunPod secure payload.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Jobs and gallery snapshots now keep prompts with `{a|b|c}` variant groups for later reuse, while endpoint submissions continue to use the deterministic seed-resolved prompt.
<!-- SECTION:FINAL_SUMMARY:END -->
