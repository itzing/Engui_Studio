---
id: engui-335
title: Use thumbnails only in mobile jobs list
status: done
created: 2026-07-04T10:40:00Z
completed: 2026-07-04T10:43:00Z
labels: [mobile, jobs, performance]
---

## Summary

Ensure the mobile jobs list never loads full image or video results for row thumbnails. Full-resolution media must remain available only in the viewer and detail screens.

## Acceptance Criteria

- Mobile video job rows render the generated poster/thumbnail instead of a `<video>` using `resultUrl`.
- Mobile image job rows avoid falling back to full `resultUrl` inside the list thumbnail slot.
- Full `resultUrl` remains available to the fullscreen viewer, details, reuse, upscale, and other full-media flows.
- Production build passes before deployment.

## Notes

- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.

## Implementation Notes

- Updated `MobileJobsScreen` so mobile job rows render only `thumbnailUrl` in the list thumbnail slot.
- Removed the mobile video row `<video src={job.resultUrl}>` path.
- Removed the mobile image row fallback from `thumbnailUrl` to full `resultUrl`.
- Full media URLs are still used by the fullscreen viewer/details flow.
