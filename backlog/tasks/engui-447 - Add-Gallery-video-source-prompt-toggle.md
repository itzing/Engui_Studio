# ENGUI-447 - Add Gallery video source prompt toggle

Status: Done
Created: 2026-07-24T07:30:17Z
Finished: 2026-07-24T07:40:00Z

## Goal

Let Gallery video details show the source image prompt alongside the video prompt on all platforms.

## Scope

- Desktop Gallery asset details dialog.
- Mobile and tablet Gallery details route.
- Gallery API payload normalization for source image prompt metadata.
- No changes to generation or reuse behavior.

## Acceptance Criteria

- [x] Video Gallery details show a prompt switcher when the asset has `sourceImageGenerationSnapshot.prompt`.
- [x] Switching to `Source image` displays the source image prompt.
- [x] Existing video `Original`/`Resolved` prompt switching still works.
- [x] Image and audio Gallery details behavior is unchanged.
- [x] Focused API/UI tests cover the new source prompt payload and switcher.

## Validation

- Focused Vitest for prompt helpers, Gallery asset APIs, and desktop Gallery details: pass.
- Targeted ESLint on touched files: pass with existing warnings only.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/gallery`, `/m/gallery/does-not-exist`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Gallery details return to the previous deployed behavior.
