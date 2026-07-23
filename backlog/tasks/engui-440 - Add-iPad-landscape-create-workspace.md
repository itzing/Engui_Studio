# ENGUI-440 - Add iPad landscape Create workspace

Status: Done
Created: 2026-07-23T13:15:00Z
Finished: 2026-07-23T13:36:00Z

## Goal

Build a dedicated tablet landscape experience for `/m/create` without changing the existing phone portrait mobile UI.

## Scope

- Detect mobile form factor by viewport and touch capability, not iPad user agent.
- Keep phone portrait on the existing mobile UI.
- Show a rotate panel on phone landscape.
- Show a rotate-to-landscape panel on tablet portrait.
- Add a tablet landscape `/m/create` workspace with:
  - Create controls on the left.
  - Preview panel on the right.
  - Bottom swipe-scrollable Jobs strip.
  - Minimal job tiles: thumbnail only, play icon for video, placeholder icon for pending jobs.
  - Contained thumbnails with black letterboxing for non-square assets.
  - Tap-to-preview job output in the right panel.
  - Asset/Info preview toggle.
  - Current mobile-style output actions, including reuse, img2vid, save to gallery/draft, and upscale where applicable.
  - Resizable Jobs strip height by dragging the top edge, capped at one third of the viewport.
- Keep desktop routes and desktop layout out of scope.

## Validation

- Focused unit/component tests for form-factor detection and tablet Create behavior: pass.
- Targeted ESLint on touched files: pass.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Production service restart and smoke checks for `/`, `/m/create`, `/m/jobs`, `/m/gallery`, `/m/carousel`, and `/api/jobs`: pass.
- Full `npm run lint`: fails on existing unrelated `prefer-const` in `src/app/api/elevenlabs/generate/route.ts`.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify `/m/create` returns to the previous phone-only mobile experience.
