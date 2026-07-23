# ENGUI-441 - Tighten iPad Jobs strip layout

Status: Done
Created: 2026-07-23T13:40:00Z
Finished: 2026-07-23T13:50:00Z

## Goal

Remove the visible Jobs strip header from the tablet landscape `/m/create` workspace and let job tiles use the full strip height.

## Scope

- Tablet landscape `/m/create` Jobs strip only.
- Remove the header/title row and refresh button from the strip.
- Remove vertical padding and max-height constraints that keep thumbnails from filling the strip.
- Keep swipe scrolling, selection, contained thumbnails, pending placeholders, and resize behavior unchanged.

## Validation

- Focused tablet Create workspace test: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/create`, `/m/jobs`, and `/api/jobs`: 200.
- Headless Chromium iPad/touch DOM check was attempted, but snap Chromium reported the page as phone landscape under its emulation, so visual validation remains covered by focused DOM assertions and route smoke.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the previous tablet strip layout returns.
