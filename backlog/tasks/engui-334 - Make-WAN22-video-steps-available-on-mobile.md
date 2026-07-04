---
id: engui-334
title: Make WAN22 video steps available on mobile
status: done
created: 2026-07-04T09:52:00Z
completed: 2026-07-04T09:52:00Z
labels: [mobile, create, video, wan22]
---

## Summary

Expose the Wan 2.2 `steps` parameter on the mobile video create surface so mobile users can tune video generation steps.

## Acceptance Criteria

- Wan 2.2 video `steps` remains available on desktop create.
- Wan 2.2 video `steps` is also visible on the mobile video create surface.
- No endpoint contract changes are required.
- Production build passes before deployment.

## Notes

- Do not launch live RunPod jobs without explicit approval.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.

## Implementation Notes

- Updated `VideoGenerationForm` advanced-parameter visibility so the Wan 2.2 hidden `steps` parameter is allowed on phone and mobile routes, matching the existing desktop override.
