# ENGUI-484 - Fix WAN22 I2V random seed follow-up

status: done
labels: [video, wan22, desktop, mobile, prompt-variants]

## Context

Wan 2.2 I2V now supports a `Random seed` checkbox, but the video form does not mirror Image Create behavior after submit. The server returns the actual random seed used for the job, while the visible seed field can remain on the previous fixed value. The checkbox can also be overwritten by stale draft hydration during reference image interactions.

## Acceptance Criteria

- [x] After a successful Wan 2.2 I2V submit with `Random seed` enabled, the visible `Seed` field updates to the actual seed returned by `/api/generate`.
- [x] The optimistic queued video job includes `seed`, `randomizeSeed`, and prompt variant metadata when available.
- [x] Uploading or selecting a reference image does not reset the `Random seed` checkbox.
- [x] Focused tests cover the seed field update and checkbox persistence.

## Plan

See `docs/wan22-i2v-random-seed-follow-up-plan.md`.

## Result

Updated `VideoGenerationForm` so successful Wan 2.2 I2V submissions apply the returned API seed back into the visible `Seed` field and include seed/randomize/prompt variant metadata in the optimistic queued job. Draft restoration now skips stale state application when the user interacts with the video form during asynchronous media restore, preserving the `Random seed` checkbox through reference image upload.
