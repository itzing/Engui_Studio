---
id: ENGUI-167
title: Add mobile LoRA selector UI for image create
status: in_progress
priority: high
labels: [mobile, create, lora, ux]
created_at: 2026-04-21
updated_at: 2026-04-21
assignee: openclaw
---

## Summary
Replace raw LoRA path inputs in mobile advanced create with an add/select flow that shows selected LoRA file names and inline weight sliders, up to 4 slots.

## Acceptance criteria
- [ ] Mobile advanced no longer shows raw path fields for LoRA slots
- [ ] Add LoRA button opens a selector and assigns the tapped LoRA to the next empty slot
- [ ] Selected LoRA panels show file name and a weight slider from -3 to 3
- [ ] Add LoRA button is hidden when 4 LoRAs are selected
- [ ] Build passes
