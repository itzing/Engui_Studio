# engui-494 - Fix mobile details prompt tabs and navigation

## Status

Done

## Context

Mobile Job Details and Gallery Details should preserve the last selected prompt tab, including `Resolved video`, and allow moving to neighboring jobs/assets without closing the details route.

## Acceptance Criteria

- [x] Mobile details do not reset the saved prompt tab while the detail payload is loading.
- [x] Mobile Job Details can navigate to the previous and next job from the current mobile jobs list.
- [x] Mobile Gallery Details can navigate to the previous and next asset from the current mobile gallery list and filter context.
- [x] Previous is disabled at the first list item.
- [x] Next is disabled at the last list item.
- [x] Focused tests cover the shared navigation snapshot helper.
- [x] Production build, service restart, smoke checks, commit, and push complete.

## Result

Mobile Jobs and Gallery list hooks now write lightweight details-navigation snapshots to `sessionStorage`. Mobile Job Details and Gallery Details read those snapshots, resolve neighboring ids from the cached order or the existing paginated APIs, and show Previous/Next controls with disabled edge states. Prompt tab preference state no longer gets overwritten by the temporary loading fallback, so `Resolved video` remains selected when the loaded item supports it.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
