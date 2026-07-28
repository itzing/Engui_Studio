---
id: engui-471
title: Use WAN22 sequence continuation PNG artifacts
status: done
labels: [video-sequences, wan22, secure-transport, desktop]
---

## Goal

Use lossless WAN22 endpoint continuation PNG artifacts as Video Sequence segment `lastFrameUrl` values, while keeping ordinary Create I2V unchanged.

## Acceptance Criteria

- [x] Video Sequence WAN22 jobs request a continuation PNG artifact.
- [x] Ordinary Create I2V jobs do not request or consume the artifact.
- [x] Secure finalization downloads/decrypts the optional `continuation_frame` artifact.
- [x] Segment sync materializes the PNG into the sequence-owned segment folder and stores it as `lastFrameUrl`.
- [x] Existing FFmpeg frame extraction remains the fallback when no artifact is present.
- [x] Focused tests cover secure payload, secure artifact finalization, and sequence segment sync behavior.

## Result

Implemented in commit `6a57b7e`. Video Sequence WAN22 jobs now set `return_continuation_frame`, secure finalization stores optional continuation frame metadata, and sequence sync materializes that PNG as the segment `lastFrameUrl`.

## Rollback

Revert the Engui commit, run `npm run build`, restart `engui-studio.service`, and verify `/video-sequences`.
