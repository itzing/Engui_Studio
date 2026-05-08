---
id: ENGUI-291
title: Wire run framing and OpenPose renderer into Studio shot materialization
status: Done
assignee: []
created_date: '2026-05-08'
labels:
  - studio-sessions
  - framing-library
  - openpose
  - generation
priority: high
dependencies: 
  - ENGUI-286
  - ENGUI-287
  - ENGUI-290
---

## Description
Apply run-level framing during shot materialization and send rendered OpenPose control PNGs to Z-Image ControlNet when pose keypoints exist.

Reference:

- `docs/studio-frame-library-spec.md`
- `docs/studio-frame-library-implementation-plan.md`

## Acceptance Criteria

- [x] Each shot resolves its pose as today and framing from run policy by orientation/fallback/default.
- [x] OpenPose-enhanced poses render exact-size control PNGs using resolved framing and output dimensions.
- [x] Rendered PNG is sent as `condition_image` with `use_controlnet=true` / ControlNet strength where appropriate.
- [x] Text-only poses continue through existing flow with framing helper prompt as text guidance.
- [x] Materialized snapshots include pose data, resolved framing transform, helper prompt, rendered control image path, and dimensions.

## Implementation Notes

Do not rely on mutable library records after materialization. Do not launch paid live jobs without explicit approval.

## Completion Notes

- Resolved framing is computed at launch time from `generationSettings.framingPolicy` using orientation-specific preset → fallback preset → default centered.
- OpenPose keypoints are decoded server-side when available, rendered to an exact output-size PNG, and attached to Z-Image generation as the image/`condition_image` input with `use_controlnet=true` and default `controlnet_strength=1`.
- Text-only poses append the resolved framing helper prompt to the submitted prompt instead of enabling ControlNet.
- The Studio job context snapshot now carries `resolvedFraming`, `framingHelperPrompt`, `renderedOpenPoseControl`, and `outputDimensions`; live generation jobs were not launched during validation.
