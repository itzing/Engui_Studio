# Mobile gallery return position

## Scope and approved interaction

Only the `/m/gallery` grid receives a new control. Place a single 44px icon-only button beside the existing search field, outside the scroll container. Neutral Bookmark saves; accented BookmarkX clears while any of the saved tile is visible; accented Undo2 returns when it is not. Returning retains the point. Manual scrolling back also changes the action to clear. No replacement menu or additional controls.

## Implementation

- Keep the explicit position independent of existing last-viewed selection.
- Capture selected tile only if it intersects the actual scroll viewport; otherwise use the first fully visible tile, falling back to a partially visible tile in a very short viewport. Persist asset ID, workspace, relative vertical offset, query and gallery filters in scoped localStorage.
- Determine visibility from tile/client rectangles, excluding virtualizer overscan. Recheck after scroll, layout and data updates.
- Reuse the existing focusAssetId API to resolve the current index, so newly inserted items cannot invalidate the point. Restore filters atomically and guard responses with the existing generation mechanism.
- Wait until the grid is mounted and measured before restoring its scroll offset. Keep the saved tile visible after a changed viewport size.
- A missing anchor clears the unusable point and reports it with the existing toast. A network failure keeps the point for retry. No database migration or production generation jobs.

## Validation and delivery

Focused geometry/persistence tests plus real gallery state and UI interaction tests cover the three button states, manual return, overscan, scrolling without selection, remount, workspace isolation, changed filters/query, shifted indices and missing/error responses. Run relevant existing gallery tests and a production build, review changes, commit/push under the owner identity, restart engui-studio.service and check HTTP routes.

## Rollback

Revert the implementation commit, rebuild, and restart engui-studio.service. The additive local position record is harmless to older versions. Do not touch unrelated files.

## Validation results (2026-10-25)

- Focused suite: 31 tests passed across seven files.
- Chromium fixture: 11 checks passed, including a real grid -> details prompt -> grid round trip, exact 20px offset after inserting newer assets, partial visibility, manual return, reload, workspace isolation, offline retry, missing anchor, narrow phone layout and tablet column geometry. All backend API responses were synthetic; no write requests or page errors occurred.
- Production build: passed. The repository intentionally skips TypeScript/lint gates during the build; a separate compiler comparison found 116 diagnostics both before and after this change, with no introduced diagnostics.
- The existing nested tile/overlay button markup emits a React development warning in jsdom; this change does not alter that markup. Browser runtime reported no page errors.
- No database changes, new dependencies, model jobs, or desktop controls.
