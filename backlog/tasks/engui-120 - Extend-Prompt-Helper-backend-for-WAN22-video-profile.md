---
id: ENGUI-120
title: Extend Prompt Helper backend for WAN 2.2 video profile
status: Done
assignee: []
created_date: '2026-04-18 21:06'
updated_date: '2026-04-18 21:47'
labels:
  - prompt-helper
  - backend
  - video
  - wan22
  - ai
dependencies:
  - ENGUI-22
  - ENGUI-58
  - ENGUI-79
  - ENGUI-119
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
  - /home/engui/Engui_Studio/specs/wan22-video-prompt-helper-profile.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reuse the existing Prompt Helper API/provider stack for WAN 2.2 video prompting.

Add a WAN-specific helper profile mode so the same local model/provider can adapt user instructions into WAN 2.2-oriented video prompts, driven by the master profile from ENGUI-119. Keep the existing JSON-hardening and prompt-helper robustness work, and avoid creating a separate provider/settings path just for WAN.

The backend should support both rewriting an existing video prompt and generating a fresh WAN 2.2 prompt from an empty prompt field.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Existing Prompt Helper endpoint/provider stack can run in a WAN 2.2 video profile mode
- [x] #2 WAN mode reuses the current provider/settings instead of introducing a new helper backend
- [x] #3 Rewrite and generate-from-empty flows both follow the WAN 2.2 master profile
- [x] #4 The response remains machine-safe and returns only the expected prompt payload without explanatory chatter
- [x] #5 Existing image Prompt Helper behavior does not regress
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the existing Prompt Helper request contract with an optional `helperProfile` and implemented a `wan22-video` profile inside the current local provider path. The backend now builds WAN-specific system/user prompts from `/specs/wan22-video-prompt-helper-profile.md`, keeps JSON-only parsing/hardening intact, and preserves the default image helper behavior for non-WAN requests. Runtime smoke checks against `/api/prompt-helper/improve` confirmed both empty-prompt generation and narrow rewrite behavior for WAN 2.2, plus a separate default image-helper regression check.
<!-- SECTION:FINAL_SUMMARY:END -->
