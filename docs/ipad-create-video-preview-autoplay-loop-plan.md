# iPad Create video preview autoplay loop plan

## Goal

When a completed video job is selected in the tablet landscape `/m/create` Jobs preview panel, the preview should start playing immediately and loop.

## Scope

- Tablet landscape `/m/create` preview panel only.
- Preserve the existing video controls.
- Preserve phone portrait mobile and desktop behavior.

## Plan

1. Update the tablet preview video element to use `autoPlay`, `loop`, `muted`, and `playsInline`.
2. Keep the current poster and controls behavior.
3. Add focused component coverage that selecting a video job renders an autoplaying, looping, muted preview.

## Expected behavior

- Selecting a video job in the tablet Create Jobs strip starts playback automatically.
- The preview loops continuously.
- The video remains controllable by the user.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and verify tablet Create video previews return to the previous click-to-play behavior.
