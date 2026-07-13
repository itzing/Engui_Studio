---
id: ENGUI-389
title: Treat WAN22 source image pose as initial video pose
status: Done
assignee: []
created_date: '2026-07-13 09:38'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
WAN2.2 image-aware video Prompt Helper currently tells the text helper to preserve the source image pose. For image-to-video this is too static: the source pose should anchor the first frame/reference, while the helper may adapt body position, gestures, expression, and secondary motion for the requested video action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Image-aware WAN2.2 video Prompt Helper instruction treats source pose as initial pose only
- [x] #2 Instruction still preserves subject identity, outfit, framing, lighting, background, and camera angle unless explicitly changed
- [x] #3 Focused test coverage verifies the instruction no longer asks to preserve pose rigidly
<!-- AC:END -->

## Implementation Notes

- Updated the WAN2.2 image-aware video Prompt Helper instruction to treat the source image as the visual starting point and identity reference.
- Changed source pose handling from rigid preservation to initial-pose anchoring, allowing body position, gestures, expression, and secondary motion to adapt for natural video.
- Added focused test assertions for the new instruction wording.
