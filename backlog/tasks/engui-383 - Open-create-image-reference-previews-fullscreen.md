# ENGUi-383 - Open Create Image reference previews fullscreen

## Status

Done

## Context

WAN2.2 Create Image reference previews currently stay embedded in the upload card. When a reference image is set, clicking it should open a fullscreen viewer; clicking the fullscreen image/backdrop should close it.

## Scope

- Desktop Create Image reference preview.
- Mobile Create Image reference preview.
- Primary and secondary image previews where the model exposes them.

## Acceptance Criteria

- [x] Clicking a populated Create Image reference preview opens it fullscreen.
- [x] Clicking the fullscreen viewer closes it.
- [x] Removing or replacing the reference still works.
- [x] Desktop and mobile Create Image surfaces behave consistently.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`.
