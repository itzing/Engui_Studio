---
id: ENGUI-323
title: QA Z-Image I2I desktop flow
status: Done
assignee: []
created_date: '2026-05-12 19:32'
labels: []
dependencies:
  - ENGUI-319
  - ENGUI-320
  - ENGUI-321
  - ENGUI-322
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run a QA and regression pass for the Z-Image I2I desktop flow after endpoint, server, submit, UI, and history work is implemented. Validate behavior without launching paid/live Studio runs unless explicitly approved.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Desktop Create Image I2I UI validation.
- Server-side init image preparation/cache validation.
- Secure submit payload validation.
- Endpoint workflow selection checks.
- Regression check for Text and Control modes.

## Acceptance Criteria

- Paste, file picker, and URL init image inputs work.
- Replacing init image clears only the positive prompt.
- Extract prompt replaces only the positive prompt.
- Long side and prepared dimensions are correct.
- PNG job copy preserves aspect ratio and composites alpha on white.
- Cache hits for repeated same image + long side.
- I2I submit payload uses secure prompt/LoRA and secure media input.
- Text mode generation path remains unchanged.
- Control mode generation path remains unchanged.
- Job detail shows I2I source thumbnail and metadata.
- Production build passes.
- Service restart verification passes after deployment.
- No paid/live endpoint generation is run without explicit approval.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented in the current Z-Image I2I change set. Verified with endpoint Python compile/workflow structural check, Engui targeted lint, production build, and Engui service restart.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
