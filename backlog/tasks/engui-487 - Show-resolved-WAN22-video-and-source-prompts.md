---
id: engui-487
title: Show resolved WAN22 video and source prompts
status: Done
labels: [wan22, video, gallery, jobs, desktop, mobile]
---

## Goal

Make Wan 2.2 video prompt metadata inspectable for wildcard debugging.

## Acceptance Criteria

- [x] Video job details can show the video prompt and resolved video prompt.
- [x] Video job details can show the source image prompt and resolved source image prompt when source metadata exists.
- [x] Gallery video details expose the same prompt variants.
- [x] Gallery asset APIs return the resolved source image prompt for video assets.
- [x] Focused tests cover metadata extraction and API response shape.

## Plan

See `docs/wan22-video-resolved-prompt-metadata-plan.md`.

## Result

Added explicit Wan 2.2 video prompt metadata keys during generation and exposed four prompt views in job/gallery details: `Video`, `Resolved video`, `Source image`, and `Resolved source`.
