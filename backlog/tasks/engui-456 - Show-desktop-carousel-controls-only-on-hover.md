# ENGUI-456 - Show desktop carousel controls only on hover

Status: Done
Created: 2026-07-27

## Goal

Hide the desktop Gallery Carousel controls by default and reveal them only while the pointer is inside the controls area.

## Scope

- Desktop Gallery Carousel modal controls.
- Preserve the mobile `/m/carousel` behavior where controls are already hidden.
- Preserve keyboard playback and scrub controls.

## Acceptance Criteria

- The desktop carousel controls are hidden when the pointer is outside the top controls area.
- Moving the pointer into the top controls area reveals the full controls panel.
- Moving the pointer out of that area hides the panel again.
- Focused tests cover the hover behavior.

## Result

Implemented on 2026-07-27.

- Desktop Gallery Carousel controls now start hidden.
- A top hover area reveals the full controls panel only while the pointer is inside it.
- Pointer movement elsewhere in the carousel no longer reveals the controls.
- The old manual Hide UI button was removed because visibility is now hover-driven.
