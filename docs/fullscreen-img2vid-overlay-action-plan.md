# Fullscreen img2vid Overlay Action Plan

## Goal

When an image is open in a fullscreen Jobs or Gallery overlay, the user should have a direct icon action that sends that image to `img2vid` and opens the Create video workflow.

## Scope

- Mobile Jobs fullscreen viewer.
- Mobile Gallery fullscreen viewer.
- Desktop Gallery fullscreen viewer.
- Existing desktop center panel Jobs action is unchanged.

## Implementation Notes

- Add a shared client helper that calls the existing job/gallery reuse endpoints and persists the returned Create draft.
- Render a `Clapperboard` icon only for image items.
- On desktop Gallery, close the fullscreen/gallery overlay after successful `img2vid` reuse and announce the Create mode change.
- On mobile, close the fullscreen viewer and navigate to `/m/create`.

## Validation

- Focused helper tests.
- Targeted ESLint for touched files.
- Production build, restart, and smoke checks.
