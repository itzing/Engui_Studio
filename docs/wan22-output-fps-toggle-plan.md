# WAN22 Output FPS Toggle Plan

## Scope

- Shared desktop and mobile Create Video form for `wan22`.
- Video Sequence Builder sequence-level settings.
- RunPod payload construction for `wan22`.
- DaSiWa I2V endpoint support is implemented in the endpoint repository.

## Behavior

Wan 2.2 continues to generate the requested frame count through the existing `length` parameter. The selected FPS only controls MP4 assembly from those generated frames:

- `16fps`: current behavior.
- `32fps`: same generated frames, twice the playback speed.

Video Sequence Builder uses one global output FPS value stored in the sequence generation defaults. Segment duration to frame-count derivation remains based on the existing sequence `targetFps`, which defaults to 16. This means selecting 32fps assembles the same generated frame budget at twice the playback speed.

## Validation

- Focused form tests for the Wan 2.2 FPS control and submitted payload.
- Focused Video Sequence API tests for sequence-level FPS persistence and segment payload.
- Production build before deployment.
