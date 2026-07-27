# ENGUI-467 - Allow freeform LoRA weight inputs

## Status

Done

## Context

LoRA weight fields in several pickers clamp or reject input while typing. Some fields use number inputs and min/max attributes, while others filter text with a regex in `onChange`. This prevents normal intermediate typing states such as `0.`, `-`, or pasted text before the user finishes editing.

## Scope

- Desktop image Create LoRA picker weight fields.
- Mobile image Create LoRA picker weight controls.
- Video Create WAN LoRA pair picker weight fields.
- Video Sequence Builder WAN LoRA pair weight fields.
- Shared validation for LoRA weights from `-10` to `10`.

## Acceptance Criteria

- LoRA weight text inputs never block raw user typing.
- Valid complete values from `-10` to `10` are accepted, including decimal and explicit plus values.
- Invalid text and out-of-range values show an inline error.
- Invalid LoRA weights are rejected before generation submit.
- Existing slider/preset controls still write valid numeric weights.

## Rollback

Revert the implementation commit, run the production build, restart `engui-studio.service`, and verify the Create and video sequence routes.
