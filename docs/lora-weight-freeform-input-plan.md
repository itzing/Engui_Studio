# LoRA Weight Freeform Input Plan

## Goal

Make every LoRA weight picker allow uninterrupted text entry while validating completed values against the shared `-10` to `10` range.

## Implementation

1. Add a shared LoRA weight parser for UI display and submit validation.
2. Replace blocking number inputs or regex-gated `onChange` handlers with text inputs using decimal input mode.
3. Show inline English error copy beside each invalid weight.
4. Keep sliders and preset buttons constrained to valid values, but let manual fields hold any text while editing.
5. Block generation submit when a selected LoRA has an invalid weight.

## Validation

- Unit tests for parser edge cases.
- Focused component tests for desktop image and video LoRA behavior.
- Targeted lint/type/build checks.
