---
id: ENGUI-21
title: Add Prompt Helper settings and provider configuration
status: Done
assignee: []
created_date: '2026-04-11 09:46'
updated_date: '2026-04-11 09:59'
labels: []
dependencies: []
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add Prompt Helper MVP settings to Engui. Extend StudioSettings/settings persistence/validation with promptHelper.provider and promptHelper.local fields (baseUrl, model, optional apiKey). Add a new Prompt Helper section under RunPod in SettingsDialog, including a Test action placeholder/wiring target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Settings include provider disabled|local
- [ ] #2 Local settings fields baseUrl, model, optional apiKey are persisted
- [ ] #3 Prompt Helper section appears under RunPod settings
- [ ] #4 Spec reference is linked
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added Prompt Helper settings shape, persistence, validation, and SettingsDialog section under RunPod with provider/local fields and Test action.
<!-- SECTION:FINAL_SUMMARY:END -->
