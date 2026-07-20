# Video Sequence Final Render Tail Trim Plan

## Problem

Video Sequence continuation uses a near-final source frame: `lastFrameUrl` is extracted at approximately `duration - 3/fps` when output metadata is available. Final render currently concatenates full segment videos, so the frames after that continuation point remain in the stitched MP4. The next segment starts from the earlier continuation frame, which can create a small backward jump at segment boundaries.

## Plan

1. Keep the current `lastFrameUrl` extraction rule unchanged.
2. During final render, compute the same continuation timestamp for each completed segment from output video metadata.
3. Trim every non-final segment to that timestamp before concatenation.
4. Leave the final segment untrimmed because it has no downstream continuation boundary.
5. Include the trim plan in the final render hash so rerendering after this fix produces a new final video URL.
6. Preserve fallback behavior: if metadata is missing, invalid, or the clip is too short for a 3-frame offset, concatenate that segment in full.

## Validation

- Focused Video Sequence API tests for trimmed non-final segments and untrimmed final segment.
- `npm run build`
- Restart `engui-studio.service` and verify status.
