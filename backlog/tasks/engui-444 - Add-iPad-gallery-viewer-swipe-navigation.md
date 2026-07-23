# ENGUI-444 - Add iPad Gallery viewer swipe navigation

Status: Done
Created: 2026-07-23T15:08:32Z
Finished: 2026-07-23T15:20:00Z

## Goal

Let the iPad landscape `/m/gallery` fullscreen viewer navigate gallery media with horizontal swipe gestures while preserving the existing edge tap navigation.

## Scope

- Tablet landscape `/m/gallery` fullscreen viewer only.
- Swipe left moves to the next loaded gallery item.
- Swipe right moves to the previous loaded gallery item.
- Existing edge tap navigation remains available.
- Phone portrait mobile gallery UI remains on its current behavior.
- Desktop gallery overlay remains unchanged.

## Validation

- Focused fullscreen viewer and mobile Gallery tests: pass.
- Targeted ESLint on touched files: 0 errors, existing mobile Gallery `<img>` warnings remain.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/gallery`, `/m/create`, `/m/jobs`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify `/m/gallery` returns to the previous deployed behavior.
