---
id: ENGUI-22
title: Implement Prompt Helper API and local provider abstraction
status: Done
assignee: []
created_date: '2026-04-11 09:46'
updated_date: '2026-04-11 09:59'
labels: []
dependencies:
  - ENGUI-21
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Prompt Helper backend endpoints and provider abstraction for MVP. Implement POST /api/prompt-helper/improve and POST /api/prompt-helper/test using a provider layer with initial local OpenAI-compatible chat completions support. Support rewrite mode and generate-from-empty mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 POST /api/prompt-helper/improve returns improvedPrompt
- [ ] #2 POST /api/prompt-helper/test performs a real mini-request
- [ ] #3 Only local provider is implemented, behind abstraction
- [ ] #4 Response text is normalized without requiring function calling
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Prompt Helper provider abstraction, local OpenAI-compatible provider, and POST /api/prompt-helper/improve and /api/prompt-helper/test routes.
<!-- SECTION:FINAL_SUMMARY:END -->
