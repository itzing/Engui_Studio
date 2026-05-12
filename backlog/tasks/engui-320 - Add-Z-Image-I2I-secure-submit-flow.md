---
id: ENGUI-320
title: Add Z-Image I2I secure submit flow
status: Done
assignee: []
created_date: '2026-05-12 19:32'
labels: []
dependencies:
  - ENGUI-319
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the Z-Image generation submit path to support I2I jobs. The submit flow should prepare or retrieve the cached init PNG copy, compute width/height from it, send the init image through the existing secure media input pipeline, keep prompt/negative prompt/LoRA in the existing secure payload, and submit `mode: "i2i"` with public technical parameters including denoise.
<!-- SECTION:DESCRIPTION:END -->

## Scope

- Z-Image submit payload construction.
- Secure media input wiring for the prepared init image copy.
- I2I metadata persistence on jobs.
- Validation before submit.

## Acceptance Criteria

- I2I Generate validates that an init image exists.
- I2I Generate validates that the positive prompt is non-empty.
- Submit prepares or reuses the cached PNG job-copy before creating the RunPod job.
- Submitted payload uses `mode: "i2i"`.
- Prompt, negative prompt, and LoRA remain inside the secure contract.
- Init image is sent through the secure media input pipeline.
- Public technical fields include width, height, seed, steps, cfg, and denoise.
- Job metadata records `initImageId`, source type, long side, denoise, source preview URL, prepared width, and prepared height.
- After submission, UI changes apply to future jobs and do not mutate the already-submitted job snapshot.

## Implementation Notes

<!-- SECTION:IMPLEMENTATION-NOTES:BEGIN -->
Implemented in the current Z-Image I2I change set. Verified with endpoint Python compile/workflow structural check, Engui targeted lint, production build, and Engui service restart.
<!-- SECTION:IMPLEMENTATION-NOTES:END -->
