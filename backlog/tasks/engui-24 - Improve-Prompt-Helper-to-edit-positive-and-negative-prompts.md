---
id: ENGUI-24
title: Improve Prompt Helper to edit positive and negative prompts
status: Done
assignee: []
created_date: '2026-04-11 11:09'
updated_date: '2026-04-11 11:14'
labels:
  - prompt-helper
  - ux
  - ai
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Upgrade Prompt Helper so it uses a stronger system prompt, sends both positive and negative prompts plus the user instruction to the local provider, returns both improved prompt fields from the API, and applies both values back into the form. Keep Ctrl/Cmd+Enter behavior scoped correctly. Include build and deploy verification after implementation.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Prompt Helper dual-prompt flow: stronger JSON-only system prompt, provider/API now send and return both positive and negative prompts, ImageGenerationForm now forwards the current negative prompt and applies both returned values back into the form. Verified with successful Next.js production build, service restart, and live API smoke test against /api/prompt-helper/improve.
<!-- SECTION:FINAL_SUMMARY:END -->
