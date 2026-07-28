# WAN22 Sequence Continuation PNG Plan

## Summary

Video Sequence WAN22 I2V jobs should request a lossless continuation PNG from the endpoint. The PNG is saved before MP4 compression and used as the segment `lastFrameUrl` for the next sequence segment. Ordinary Create I2V jobs keep the current MP4-only behavior.

## Endpoint Contract

- Request flag: `return_continuation_frame: true`.
- Primary result remains `transport_result.result_media` with the MP4.
- Optional artifact:
  - `transport_result.artifacts.continuation_frame`
  - `kind: "image"`
  - `mime: "image/png"`
  - encrypted with the same secure transport envelope pattern.

## Engui Flow

1. `generateVideoSequenceSegment` adds `return_continuation_frame: true` to WAN22 sequence jobs.
2. Secure finalization downloads/decrypts the optional artifact and stores a local URL in job options metadata.
3. `syncVideoSequenceSegmentStatus` materializes the artifact into the sequence-owned segment frames folder and sets `lastFrameUrl`.
4. If the artifact is missing, existing FFmpeg extraction remains the fallback.

## Non-Goals

- No raw latent handoff.
- No behavior change for ordinary Create I2V.
- No live RunPod validation job without explicit approval.
