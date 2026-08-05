# WAN22 Looped Video Plan

## Scope

- Shared desktop and mobile Create Video form for `wan22`.
- RunPod payload construction for `wan22`.
- DaSiWa I2V endpoint support is implemented in the endpoint repository.

## Behavior

Wan 2.2 gets a `Looped` checkbox. When it is enabled, Engui sends `looped: true` in the generation request. The endpoint uses the uploaded source image as both the `start_image` and `end_image` conditioning input.

The endpoint should trim the final decoded frame before MP4 assembly when `looped` is enabled. Conditioning still sees the end frame, but the rendered file avoids a duplicate hold frame at the loop boundary.

## Validation

- Focused form tests for the Wan 2.2 `Looped` control and submitted payload.
- Secure RunPod payload test for `looped: true`.
- Endpoint Python compile, workflow JSON parsing, and structural prompt rewrite smoke tests.
- Production build before deployment.
