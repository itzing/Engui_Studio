# iPad Gallery Toolbar Layout

## Context

The iPad landscape `/m/gallery` toolbar still used the phone-oriented two-row filter layout. The user wanted a denser tablet toolbar with both filter groups, a desktop-style columns slider, and refresh in one row, without changing phone portrait mobile.

## Plan

- Reuse the existing tablet form-factor detection from the mobile shell.
- Keep phone portrait on the existing two filter rows.
- For tablet landscape, render one toolbar row:
  - semantic filters on the left;
  - a visible `|` divider;
  - media, favorites, and trash filters;
  - a right-aligned `|` divider;
  - a desktop-style columns slider;
  - refresh on the far right.
- Let the tablet grid use the selected column count while phone portrait stays at three columns.

## Validation

- Run focused mobile gallery toolbar and grid sizing tests.
- Run targeted ESLint on touched files.
- Run production build, restart the Engui service, and smoke `/m/gallery`.
