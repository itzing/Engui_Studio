# ENGUI-420 - Add gallery carousel ratio filters

status: done
labels: [gallery, carousel, mobile, desktop, controls, ratio]

## Goal

Let users choose which gallery asset orientations are included in the Gallery Carousel feed.

## Scope

- Desktop fullscreen Gallery Carousel controls.
- Mobile `/m/carousel` settings screen.
- Add `Landscape` and `Portrait` checkboxes.
- Default both checkboxes to enabled so current behavior remains unchanged.
- The carousel feed should include only checked orientations for videos and image slots.
- If no orientation is checked, the feed should be empty.
- Preserve existing `Images`, `Speed`, `Scrub`, pause, drag, keyboard, close, and mobile portrait-gate behavior.

## Validation

- Helper tests for orientation filtering.
- Desktop carousel component tests for default and filtered fetch/feed behavior.
- Mobile carousel tests for passing selected ratio settings into the fullscreen player.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the carousel returns to the previous unfiltered feed behavior.

## Result

Implemented for desktop and mobile Gallery Carousel. Both surfaces now expose `Landscape` and `Portrait` checkboxes, defaulting to enabled. The shared carousel filters loaded videos and optional image slots by the selected orientations before building the feed. If both filters are disabled, the carousel shows an empty feed state.
