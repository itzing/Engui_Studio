# ENGUI-439 - Reduce mobile vertical carousel video load

Status: Done
Created: 2026-07-23T11:39:50Z
Finished: 2026-07-23T11:47:30Z

## Goal

Fix the mobile portrait, landscape-only Gallery Carousel performance regression without changing gallery asset orientation metadata.

## Scope

- Reduce retained/preloaded slots for vertical carousel movement.
- Request video playback only when a video element is mounted or ready, not on every carousel frame.
- Keep the existing horizontal carousel behavior unchanged.
- Do not implement gallery asset dimensions backfill or orientation metadata repair in this task.

## Validation

- Focused carousel component tests: pass.
- Targeted ESLint on touched code: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Production service restart and smoke checks: pass.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify mobile carousel returns to the previous behavior.
