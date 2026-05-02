---
id: ENGUI-104
title: Raise z-image UI LoRA cap to 8 and match mobile/desktop behavior
status: Done
assignee: [openclaw]
created_date: '2026-05-02 19:05'
labels:
  - frontend
  - z-image
  - lora
  - ux
dependencies: []
priority: high
---

## Description

Raise the z-image UI LoRA slot cap from 4 to 8 and make desktop follow the same UX pattern as mobile: show only populated LoRA entries and expose an Add LoRA action while the cap has not been reached.

## Acceptance Criteria

- [x] z-image UI supports up to 8 LoRA slots
- [x] Desktop create UI shows only populated LoRA rows by default
- [x] Desktop create UI offers an Add LoRA button until the 8-slot cap is reached
- [x] Mobile behavior remains aligned with desktop
- [x] Build passes and app is redeployed
