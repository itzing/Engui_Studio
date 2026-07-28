---
id: engui-471
title: Use WAN22 sequence continuation PNG artifacts
status: in_progress
labels: [video-sequences, wan22, secure-transport, desktop]
---

## Goal

Use lossless WAN22 endpoint continuation PNG artifacts as Video Sequence segment `lastFrameUrl` values, while keeping ordinary Create I2V unchanged.

## Acceptance Criteria

- [ ] Video Sequence WAN22 jobs request a continuation PNG artifact.
- [ ] Ordinary Create I2V jobs do not request or consume the artifact.
- [ ] Secure finalization downloads/decrypts the optional `continuation_frame` artifact.
- [ ] Segment sync materializes the PNG into the sequence-owned segment folder and stores it as `lastFrameUrl`.
- [ ] Existing FFmpeg frame extraction remains the fallback when no artifact is present.
- [ ] Focused tests cover secure payload, secure artifact finalization, and sequence segment sync behavior.

## Rollback

Revert the Engui commit, run `npm run build`, restart `engui-studio.service`, and verify `/video-sequences`.
