# ENGUI-437 - Add mobile portrait landscape-only carousel

Status: Done
Created: 2026-07-23T09:41:51Z
Finished: 2026-07-23T09:50:00Z

## Goal

When mobile Gallery Carousel is started with only `Landscape` selected, allow playback in portrait device orientation and move the tape from bottom to top.

## Scope

- Mobile `/m/carousel` only.
- Keep the existing rotate-phone gate for mixed or portrait-enabled orientation filters.
- Add a vertical bottom-to-top tape mode to the shared carousel player for the mobile landscape-only portrait case.
- Preserve mobile tap-to-pause and swipe-to-close behavior.

## Validation

- Focused mobile carousel and carousel component tests: pass.
- Targeted ESLint on touched files: pass with existing test warning only.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Production service restart and smoke checks: pass.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify mobile carousel returns to landscape-only playback with the portrait rotate-phone gate.
