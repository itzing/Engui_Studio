# ENGUI-506 - Reflect WAN22 T2V random seed after submit

## Status

Done

## Problem

WAN22 T2V exposes the same `Random seed` checkbox as WAN22 I2V, but submissions do not send the `randomizeSeed` flag through the generation request. As a result, the API cannot generate a fresh seed and the form keeps showing the previous seed after queueing a generation package.

## Acceptance Criteria

- [x] WAN22 T2V submits `randomizeSeed=true` when the checkbox is enabled.
- [x] WAN22 T2V reflects the returned API seed in the visible seed input after submit, matching WAN22 I2V behavior.
- [x] The queued optimistic video job stores the returned seed and `randomizeSeed` flag.
- [x] Focused regression coverage protects the T2V submit path.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
