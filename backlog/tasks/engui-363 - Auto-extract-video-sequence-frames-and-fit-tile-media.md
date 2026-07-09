---
id: engui-363
title: Auto-extract video sequence frames and fit tile media
status: done
created: 2026-07-09
updated: 2026-07-09
---

## Goal

Make desktop Video Sequence Builder segment cards keep first/last frames current automatically and display portrait or landscape media without cropping inside the tile.

## Acceptance Criteria

- [x] First and last frames are extracted automatically when a segment output video changes.
- [x] Gallery video seeding also attempts automatic first/last frame extraction.
- [x] Manual inspector Extract frames action is hidden for now.
- [x] Segment tile media cells fit portrait and landscape media without forcing the output preview into landscape crop.
- [x] Focused regression tests pass.
- [x] Production build passes and `engui-studio.service` is restarted.

## Result

Segment output changes now clear stale frame URLs and best-effort auto-extract fresh first/last frames from local output videos. Applying a Gallery video as the first segment also attempts frame extraction immediately. The desktop segment inspector no longer shows the manual Extract frames action. Segment tile previews use a stable fixed-height media strip with contained image/video rendering so portrait and landscape media fit inside the same item without crop-driven landscape bias.
