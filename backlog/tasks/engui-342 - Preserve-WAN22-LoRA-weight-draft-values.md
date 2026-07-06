# ENGUI-342 - Preserve WAN22 LoRA weight draft values

---
status: Done
priority: Medium
labels: [video, wan22, lora, desktop, mobile]
created: 2026-07-06
---

## Problem

WAN22 Create Video LoRA pair selections are saved in the video draft, but their high/low weight values are held in separate component state. After launching a job and navigating away to Jobs, returning to Create Video restores the selected LoRA pair while the weights reset to the default 0.8.

## Acceptance Criteria

- WAN22 LoRA high/low weights persist in the video draft together with the selected pair paths.
- Returning to Create Video on mobile restores the edited LoRA weights instead of resetting to 0.8.
- Desktop Create Video uses the same persistence behavior.
- WAN22 generation submission still sends the selected high/low weights.
- Add focused coverage for draft persistence or submit state behavior.

## Notes

- The fix should keep the default 0.8 fallback for new or legacy drafts without saved weight fields.

## Result

- Implemented on 2026-07-06.
- WAN22 LoRA high/low weights are persisted into the video draft `parameterValues`.
- Draft hydration restores `lora_high_1_weight` through `lora_low_4_weight`, with 0.8 fallback for legacy drafts.
- Focused regression test covers editing weights, saving to `engui.create.state.v2`, and restoring after remount.
