# ENGUI-483 - Add WAN22 I2V random seed toggle

status: done
labels: [video, wan22, desktop, mobile, prompt-variants]

## Context

Wan 2.2 I2V prompt variants such as `{a|b|c}` are resolved deterministically from the seed. The video create form currently keeps the default fixed seed, so repeated generations can resolve the same variant every time.

## Acceptance Criteria

- [x] Desktop Create Video for `Wan 2.2` exposes a random seed checkbox.
- [x] Mobile Create for `Wan 2.2` exposes the same control through the shared video form.
- [x] Wan 2.2 I2V submissions send `randomizeSeed=true` when enabled.
- [x] The random seed setting is persisted in video create draft state.
- [x] The random seed setting is persisted in video create preset snapshots.
- [x] Focused tests cover submit payload, draft restore, and preset restore.

## Plan

See `docs/wan22-i2v-random-seed-toggle-plan.md`.

## Result

Implemented a `Random seed` checkbox for Wan 2.2 I2V in the shared Create Video form. The setting is sent as `randomizeSeed` to `/api/generate`, saved in video create drafts, and preserved in local/server video create presets.
