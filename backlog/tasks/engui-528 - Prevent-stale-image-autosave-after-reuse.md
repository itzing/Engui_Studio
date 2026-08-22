# engui-528 - Prevent stale image autosave after reuse

## Status

Done

## Context

Jobs image `To txt2img` can still open Image Create with Randomize disabled after a reuse action from a mounted Create form. The reuse payload can contain `randomizeSeed: true`, but the mounted Image Create autosave effect may still have a stale local snapshot with `randomizeSeed: false` and can write it back over the freshly persisted reuse draft.

## Acceptance Criteria

- [x] Image Create skips the stale autosave pass immediately after an image reuse draft event.
- [x] The saved reuse draft remains intact when the mounted form receives `engui:create-reuse-draft`.
- [x] Focused hook coverage verifies stale local snapshots do not overwrite reuse drafts.

## Notes

Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
