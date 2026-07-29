# Video Sequence Source Frame Fullscreen Plan

## Goal

Let users inspect the selected segment source frame at a large size from the desktop Video Sequence Segment inspector.

## Target Behavior

- The Source thumbnail in the Segment inspector becomes clickable when a source frame URL exists.
- Clicking opens a fullscreen dark overlay with the source frame rendered via `object-contain`.
- The overlay closes through the close button or by clicking outside the image.
- Empty source frame state remains non-interactive.

## Validation

- Focused Video Sequence helper/component coverage for source frame inspection affordances.
- Targeted lint for the changed files.
- Production build, service restart, and smoke checks for `/video-sequences` and core APIs.
