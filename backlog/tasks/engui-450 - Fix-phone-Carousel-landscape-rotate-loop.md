# ENGUI-450 - Fix phone Carousel landscape rotate loop

Status: Done
Created: 2026-07-24T14:29:48Z
Finished: 2026-07-24T14:35:00Z

## Goal

Fix phone `/m/carousel` so portrait-enabled carousel playback asks the user to rotate once, then opens the fullscreen carousel after the phone is in landscape.

## Scope

- Phone `/m/carousel` route and shell orientation gating.
- Preserve global phone-landscape blocking on other `/m/*` routes.
- Preserve tablet portrait and tablet landscape behavior.
- Preserve landscape-only vertical portrait carousel behavior.

## Acceptance Criteria

- [x] Phone `/m/carousel` can render its fullscreen player while the phone is in landscape.
- [x] Other mobile routes still show `Rotate your phone` in phone landscape.
- [x] Portrait-enabled carousel selections still show the local rotate prompt in phone portrait.
- [x] Portrait-enabled carousel selections render the player after phone landscape rotation.
- [x] Focused tests cover the route exception and the carousel portrait-to-landscape case.

## Validation

- Focused mobile app shell tests: pass.
- Focused mobile Gallery Carousel tests: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/carousel`, `/m/create`, `/m/gallery`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify phone landscape returns to the global shell gate everywhere.
