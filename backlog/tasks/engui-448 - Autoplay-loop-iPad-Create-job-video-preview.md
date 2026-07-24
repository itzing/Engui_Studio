# ENGUI-448 - Autoplay loop iPad Create job video preview

Status: Done
Created: 2026-07-24T07:43:05Z
Finished: 2026-07-24T07:48:00Z

## Goal

Make selected video job previews start immediately and loop in the tablet landscape `/m/create` workspace.

## Scope

- Tablet landscape `/m/create` preview panel only.
- Preserve video controls.
- Preserve phone portrait mobile and desktop behavior.

## Acceptance Criteria

- [x] Tablet Create video preview renders with autoplay enabled.
- [x] Tablet Create video preview loops.
- [x] Tablet Create video preview is muted so iPad Safari can autoplay it.
- [x] Existing image preview and job selection behavior is unchanged.
- [x] Focused component tests cover the video preview attributes.

## Validation

- Focused tablet Create workspace tests: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/create`, `/m/jobs`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify tablet Create video preview returns to manual playback.
