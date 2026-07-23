# ENGUI-442 - Fix tablet Jobs icon and Gallery grid

Status: Done
Created: 2026-07-23T14:11:00Z
Finished: 2026-07-23T14:18:00Z

## Goal

Fix two tablet mobile UI regressions after the tablet landscape Create workspace work.

## Scope

- Center pending job type icons inside tablet `/m/create` Jobs strip tiles.
- Fix `/m/gallery` virtual row sizing so each virtualized row matches the actual three-column square tile height on wide tablet viewports.
- Keep phone portrait behavior, gallery filters, swipe scrolling, viewer selection, and tablet Jobs strip resizing unchanged.

## Validation

- Focused tablet Create workspace tests: pass.
- Focused mobile gallery grid sizing tests: pass.
- Targeted ESLint on touched files: 0 errors, existing mobile Gallery `<img>` warnings remain.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/create`, `/m/gallery`, `/m/jobs`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify `/m/create` and `/m/gallery` return to the previous deployed behavior.
