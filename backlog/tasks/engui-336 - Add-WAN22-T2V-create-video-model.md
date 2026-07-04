---
id: engui-336
title: Add WAN22 T2V Create Video model
status: pending
created: 2026-07-04T20:11:00Z
labels: [video, runpod, wan22, t2v, desktop, mobile]
---

## Summary

Add a separate `Wan 2.2 T2V` model to Create Video, backed by a separate `wan22-t2v` RunPod endpoint.

## Acceptance Criteria

- `wan22-t2v` appears as a separate video model on desktop Create Video.
- `wan22-t2v` appears as a separate video model on mobile Create Video.
- `wan22-t2v` uses text-only inputs and does not show or require source image upload.
- RunPod settings support an endpoint mapping for `wan22-t2v`.
- Secure transport is enabled for `wan22-t2v`.
- Existing `wan22` I2V behavior remains unchanged.
- Production build passes and Engui service is restarted after deployment.

## Notes

- Implementation plan: `docs/wan22-t2v-lightning-implementation-plan.md`.
- Rollback: revert the Engui integration commit, rebuild, and restart `engui-studio.service`.
