# ENGUI-446 - Allow iPad Create preview swipe through pending jobs

Status: Done
Created: 2026-07-23T15:38:43Z
Finished: 2026-07-23T15:46:00Z

## Goal

Let the tablet landscape `/m/create` preview panel keep job swipe navigation available when the selected job has no output media yet.

## Scope

- Tablet landscape `/m/create` only.
- Swipe left/right should navigate between loaded Jobs strip items while the preview panel shows an image output or a no-output placeholder.
- Processing, queued, finalizing, failed, and other no-output job states must not trap the user on that selected job.
- Preserve completed video/audio preview controls.
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
