# ENGUI-476 - Open sequence source frame fullscreen

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

Video Sequence users need to inspect the actual source frame quality for the selected segment. The Segment inspector currently shows only a small cropped thumbnail, which makes it hard to judge whether a chained source frame is clean enough before generating the next segment.

## Scope

- Surface: desktop `/video-sequences` Segment inspector.
- Make the selected segment source frame preview clickable when a source frame is available.
- Open the source frame in a large fullscreen overlay using contained image fit.
- Keep existing source mode, URL editing, Gallery picker, manual frame picker, and generation behavior unchanged.

## Rollback

Revert the Engui commit, run `npm run build`, then restart `engui-studio.service`.

## Result

Implemented in the desktop Video Sequence Segment inspector. Clicking an available source frame thumbnail opens a fullscreen dark overlay with the frame displayed via contained image fit, matching the Create Video reference image fullscreen behavior. Empty source frame previews remain non-interactive.
