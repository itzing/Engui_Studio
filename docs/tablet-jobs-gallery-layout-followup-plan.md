# Tablet Jobs and Gallery Layout Follow-Up

## Context

The tablet landscape Create workspace exposed two visual issues:

- Pending job type icons in the bottom Jobs strip were not centered inside the full-height tile.
- Mobile Gallery still used a fixed `128px` virtual row estimate, so on iPad landscape the next row started far too early and overlapped the previous row.

## Plan

- Make Jobs strip tiles flex-centered while preserving full-height square sizing and contained thumbnails.
- Move Mobile Gallery row sizing into a small helper.
- Estimate virtual Gallery row height from the measured scroll container width divided by the three grid columns.
- Re-measure the virtualizer when the scroll container width changes.

## Validation

- Run focused component/unit tests for tablet Create and mobile Gallery grid sizing.
- Run targeted ESLint and production build.
- Restart Engui and smoke `/m/create` and `/m/gallery`.
