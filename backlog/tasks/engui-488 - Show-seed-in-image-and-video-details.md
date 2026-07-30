# ENGUI-488 - Show seed in image and video details

Status: done

## Goal

Expose the stored generation seed in Job Details and Gallery Details for image and video generations only.

## Scope

- Desktop Job Details
- Desktop Gallery Details
- Mobile Job Details
- Mobile Gallery Details
- Gallery asset APIs that normalize metadata for details/list payloads

## Notes

- Do not show seed for audio, tts, or music jobs.
- Show only `Seed`; do not add a separate `Random seed` display.
- Reuse stored `options.seed` or gallery `generationSnapshot.seed`.

## Result

Implemented in Engui Studio. Gallery asset APIs now return `seed` only for image/video assets, and desktop/mobile Job Details and Gallery Details render a `Seed` row when a stored seed exists.
