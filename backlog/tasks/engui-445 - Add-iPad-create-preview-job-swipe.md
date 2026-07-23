# ENGUI-445 - Add iPad Create preview job swipe

Status: Done
Created: 2026-07-23T15:25:04Z
Finished: 2026-07-23T15:34:00Z

## Goal

Let the tablet landscape `/m/create` preview panel navigate between jobs with horizontal swipes when an image output is currently displayed.

## Scope

- Tablet landscape `/m/create` only.
- Swipe left on the image preview selects the next loaded Jobs strip item.
- Swipe right on the image preview selects the previous loaded Jobs strip item.
- Preserve existing Jobs strip taps and preview action buttons.
- Preserve video/audio preview controls by not attaching this gesture to non-image previews.
- Preserve phone portrait mobile and desktop behavior.

## Validation

- Focused tablet Create workspace tests: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/create`, `/m/gallery`, `/m/jobs`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify `/m/create` returns to the previous deployed behavior.
