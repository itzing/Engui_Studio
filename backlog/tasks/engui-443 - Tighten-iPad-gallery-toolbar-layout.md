# ENGUI-443 - Tighten iPad Gallery toolbar layout

Status: Done
Created: 2026-07-23T14:42:00Z
Finished: 2026-07-23T14:56:00Z

## Goal

Make the iPad landscape `/m/gallery` toolbar denser by placing filters, column controls, and refresh in one row.

## Scope

- Tablet landscape `/m/gallery` only.
- Keep the two existing filter groups on the left with a visible `|` divider between them.
- Put a desktop-style columns slider on the right, separated from the filters by a visible `|`.
- Keep Refresh at the far right.
- Preserve phone portrait mobile gallery toolbar and three-column grid behavior.

## Validation

- Focused mobile Gallery toolbar and grid sizing tests: pass.
- Targeted ESLint on touched files: 0 errors, existing mobile Gallery `<img>` warnings remain.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Restarted `engui-studio.service`: active on port 3010.
- Smoke checks for `/`, `/m/gallery`, `/m/create`, `/m/jobs`, and `/api/jobs`: 200.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify `/m/gallery` returns to the previous deployed layout.
