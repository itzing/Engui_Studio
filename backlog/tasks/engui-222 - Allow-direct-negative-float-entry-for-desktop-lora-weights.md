---
id: ENGUI-222
title: Allow direct negative float entry for desktop LoRA weights
status: inbox
priority: high
labels: [desktop, create, lora, ux]
created_at: 2026-05-05
updated_at: 2026-05-05
assignee: openclaw
---

## Summary
Fix desktop Create Image LoRA weight inputs so users can type negative and decimal values directly, including values like `-1.75`, without cursor workarounds.

## Acceptance criteria
- [ ] Desktop Create Image LoRA weight fields accept direct typing of negative float values such as `-1.75`
- [ ] Temporary in-progress states like `-` and `-1.` are allowed while editing
- [ ] Submitted values still serialize to numeric LoRA weights correctly
- [ ] Build passes
