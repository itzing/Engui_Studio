# ENGUi-384 - Open Create Video reference preview fullscreen

## Status

Done

## Context

WAN2.2 Create Video image reference preview currently stays embedded in the upload card. It should match Create Image behavior: clicking a populated reference image opens a fullscreen viewer, and clicking the viewer/backdrop closes it.

## Scope

- Desktop Create Video image reference preview.
- Keep remove/replace behavior unchanged.
- Mobile create reference fullscreen is already handled by the shared mobile create surface.

## Acceptance Criteria

- [x] Clicking a populated Create Video image reference preview opens it fullscreen.
- [x] Clicking the fullscreen viewer closes it.
- [x] Removing or replacing the reference still works.
- [x] Focused component coverage verifies the behavior.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`.
