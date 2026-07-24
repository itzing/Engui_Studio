# Phone Carousel Landscape Rotate Loop Plan

## Context

Phone `/m/carousel` has its own rotate prompt when the selected carousel content needs landscape playback. The app shell also blocks every phone-landscape route with `Rotate your phone`, which creates a loop: the carousel asks for landscape, then the shell replaces the carousel with another rotate prompt after the user rotates.

## Plan

1. Add a narrow `MobileAppShell` opt-out for the global phone-landscape gate.
2. Use that opt-out only on `/m/carousel`.
3. Keep tablet portrait gating and normal mobile routes unchanged.
4. Add focused tests for the shell exception and phone portrait-selected carousel playback after rotation.

## Validation

- Focused mobile shell and carousel tests.
- Targeted ESLint on touched files.
- `git diff --check`.
- `npx prisma validate`.
- Production build and `engui-studio.service` restart.
- Smoke checks for `/m/carousel`, `/m/create`, `/m/gallery`, and `/api/jobs`.
