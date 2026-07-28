---
id: engui-474
title: Preserve Wan Animate source video preview framing
status: done
labels: [create, video, wan-animate, desktop, mobile, preview]
---

## Goal

Make the Create Video Wan Animate source video preview show the whole uploaded video frame instead of center-cropping portrait videos in the preview card.

## Acceptance Criteria

- [x] Uploaded portrait source videos render fully contained in the preview area.
- [x] The upload submit path keeps sending the original source video file unchanged.
- [x] Desktop and mobile Create surfaces share the same fixed behavior.
- [x] Focused component/API checks cover preview fit and secure source video submission.

## Result

Implemented in this task. The shared Create Video source video preview now uses contain fitting on a dark backing surface, so portrait uploads are shown whole instead of center-cropped. The submit path remains unchanged and sends the original file bytes through secure `source_video` media input for Wan Animate.

## Rollback

Revert the Engui implementation commit, run `npm run build`, restart `engui-studio.service`, and verify `/` plus `/m/create`.
