# ENGUI-438 - Use English mobile carousel rotate copy

Status: Done
Created: 2026-07-23T10:06:30Z
Finished: 2026-07-23T10:10:00Z

## Goal

Use English UI copy for the mobile Gallery Carousel rotate-phone gate.

## Scope

- Mobile `/m/carousel` orientation gate copy.
- Focused component test expectations.
- Preserve all carousel playback and orientation behavior.

## Validation

- Focused mobile carousel component test: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Production service restart and route smoke checks: pass.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the previous copy returns.
