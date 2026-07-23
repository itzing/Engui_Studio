# iPad Create Preview Job Swipe

## Context

The tablet landscape `/m/create` workspace has a right-side preview panel and a bottom Jobs strip. Users can tap strip items, but swiping over an image in the preview panel does not move through jobs.

## Plan

- Keep the gesture scoped to the tablet Create workspace component.
- Track the active job's position within the loaded Jobs strip entries.
- Add horizontal touch gesture handling to the preview media surface only in asset mode.
- Trigger navigation for image previews and no-output placeholders so processing jobs do not trap navigation.
- Keep completed video/audio controls outside this gesture so playback controls are not affected.
- Use the same direction convention as the Gallery viewer: swipe left for next, swipe right for previous.
- Keep the selected strip item scrolled into view when selection changes.

## Validation

- Add a focused tablet Create regression test for left/right preview swipes.
- Run focused Vitest, targeted lint, production build, service restart, and smoke `/m/create`.
