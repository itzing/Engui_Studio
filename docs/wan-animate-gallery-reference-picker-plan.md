# Wan Animate Gallery Reference Picker Plan

## Scope

Surface: desktop Create and mobile Create. The implementation should reuse the existing Create Video image reference state so Wan Animate receives the same `image` form field whether the user uploads, drags, or picks from Gallery.

## Approach

- Add a small Gallery picker dialog inside `VideoGenerationForm` for models whose image input is visible.
- Fetch image assets from `/api/gallery/assets` for the active workspace with `type=image`, `bucket=all`, newest-first ordering, and optional search.
- On selection, fetch the selected asset URL as a blob, wrap it in a `File`, set `imageFile`, and keep the Gallery URL as `imagePreviewUrl`.
- Keep the existing file upload, drag/drop, remove, fullscreen preview, draft hydration, and generation submit paths unchanged.

## Validation

- Add focused component coverage for Gallery selection.
- Re-run the existing video Create component coverage, `git diff --check`, Prisma validation, production build, service restart, and HTTP smoke checks.
