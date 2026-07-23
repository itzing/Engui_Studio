# Mobile Carousel Vertical Video Performance Plan

## Objective

Reduce resource pressure in the mobile portrait, landscape-only Gallery Carousel mode while leaving normal phone landscape playback unchanged.

## Background

The vertical movement mode sizes landscape videos to the portrait viewport width. That makes each slot shorter, so the existing large trim buffer can keep many more video elements alive than the horizontal carousel. The player also requests playback for every active video after each active slot update, which can happen every animation frame.

## Implementation

- Keep the horizontal trim buffer unchanged.
- Use a smaller trim buffer for vertical movement so the DOM retains only nearby vertical slots.
- Move video playback requests into the video element mount path and retry from loaded metadata if needed.
- Remove the frame-driven playback request effect.
- Do not modify dimension derivation, gallery snapshots, or orientation filtering in this task.

## Validation

- Add focused component coverage for vertical slot retention after a large vertical scrub.
- Add focused component coverage that mounted videos are not replayed on every frame.
