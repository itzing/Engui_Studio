# ENGUI-430 - Persist gallery media type filters

status: done
labels: [desktop, mobile, gallery, filters, bug]

## Goal

Make Gallery media type filters (`image`, `video`, `audio`) persist per device and apply reliably on both mobile and desktop.

## Scope

- Shared `useMobileGalleryScreen` hook used by mobile Gallery and desktop Gallery overlay.
- Persist media type filters in `localStorage` per workspace and surface.
- Keep semantic bucket filters (`all`, `common`, `draft`, `upscale`) unchanged.
- Prevent stale Gallery API responses from old type filters from replacing the current filtered grid.

## Validation

- Focused regression tests for media filter persistence and stale fetch protection.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Gallery returns to previous filter behavior.
