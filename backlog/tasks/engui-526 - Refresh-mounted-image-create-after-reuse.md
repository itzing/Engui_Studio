# ENGUI-526 - Refresh mounted Image Create after reuse

Labels: [jobs, reuse, create, seed, desktop, mobile]

## Summary

Fix Jobs image `To txt2img` reuse so Image Create reflects the saved `randomizeSeed` value even when the Create form is already mounted.

## Scope

- Jobs reuse payload contract for image `txt2img`.
- Client create-draft reuse notification.
- Image Create draft hydration after reuse events.

## Acceptance Criteria

- [x] Image job `To txt2img` payload preserves `randomizeSeed: true` from job options.
- [x] Mounted Image Create forms refresh from the newly saved reuse draft instead of keeping stale state.
- [x] Focused tests cover the reuse payload and mounted draft refresh behavior.

## Result

- Added a reuse-draft client event when reuse saves a Create draft.
- Image Create draft persistence now listens for image reuse-draft events and hydrates the mounted form from the latest stored draft.
- Added regression coverage for Jobs image `txt2img` payloads preserving `randomizeSeed: true` and mounted Image Create hydration after reuse.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Jobs reuse returns to the previous behavior.
