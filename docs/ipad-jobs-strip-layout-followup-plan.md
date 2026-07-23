# iPad Jobs Strip Layout Follow-Up

## Context

The first tablet landscape `/m/create` workspace shipped the Jobs strip with a small header row and capped square tiles. On iPad this leaves unused vertical space above and below the job thumbnails.

## Plan

- Remove the visible Jobs strip header row.
- Remove the refresh action from the strip chrome.
- Let job tiles, loading placeholders, and loading-more indicators use the full strip height.
- Preserve horizontal swipe scrolling, contained thumbnails on black backgrounds, selection state, and drag resize behavior.

## Validation

- Run the focused tablet Create workspace component test.
- Run targeted ESLint on touched source and test files.
- Run production build, restart the Engui service, and smoke `/m/create`.
