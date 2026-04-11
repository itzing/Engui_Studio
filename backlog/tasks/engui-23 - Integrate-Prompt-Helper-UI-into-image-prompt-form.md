---
id: ENGUI-23
title: Integrate Prompt Helper UI into image prompt form
status: Done
assignee: []
created_date: '2026-04-11 09:46'
updated_date: '2026-04-11 09:59'
labels: []
dependencies:
  - ENGUI-21
  - ENGUI-22
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Prompt Helper button under the image prompt textarea in ImageGenerationForm. Implement modal UX, loading/error states, Ctrl/Cmd+Enter submit, and immediate prompt replacement on success. Keep instruction text on failure for retry.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prompt Helper button appears under image prompt textarea
- [ ] #2 Modal supports instruction entry and submit
- [ ] #3 Prompt is replaced immediately on success
- [ ] #4 Failure keeps modal open with typed instruction preserved
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated Prompt Helper button and modal into ImageGenerationForm with disabled/loading/error states, Ctrl/Cmd+Enter submit, and direct prompt replacement on success.
<!-- SECTION:FINAL_SUMMARY:END -->
