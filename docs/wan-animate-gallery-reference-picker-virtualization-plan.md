# Wan Animate Gallery Reference Picker Virtualization Plan

## Scope

Surface: desktop Create and mobile Create. The Wan Animate Gallery reference picker should support large image galleries without stopping after the initial page.

## Approach

- Keep using `/api/gallery/assets` with `type=image`, `bucket=all`, newest-first sorting, and search.
- Replace the fixed first-page grid with paginated loading through the existing Gallery API `page`, `limit`, and `pagination.totalCount` contract.
- Virtualize dialog rows with `@tanstack/react-virtual`, render placeholders for unloaded cells, and load the pages that overlap the visible row range plus overscan.
- Preserve the current selection path: selected Gallery image is fetched as a blob, wrapped as a `File`, and submitted through the existing `image` form field.

## Validation

- Add focused component coverage proving scrolling loads a later Gallery page.
- Re-run focused VideoGenerationForm tests, `git diff --check`, Prisma validation, production build, service restart, and HTTP smoke checks.
