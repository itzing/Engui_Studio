# ENGUI-417 - Add mobile landscape Gallery carousel

status: done
labels: [gallery, mobile, video, image, viewer, controls, landscape]

## Goal

Add a mobile-only Gallery Carousel entry that starts from settings and plays the carousel only in landscape fullscreen.

## Scope

- Add a bottom navigation item between `Jobs` and `Gallery`.
- Add a mobile carousel settings screen.
- Settings include the same carousel settings surface as desktop where relevant: Images, Speed, and Scrub.
- Add a `Start` action at the bottom of the settings screen.
- Pressing `Start` opens a blocking fullscreen panel.
- In portrait, the blocking panel says `Поверните телефон` and has a close button.
- Closing the blocking panel returns to settings.
- In landscape, the blocking panel starts the carousel tape fullscreen across the full viewport width and height.
- Tap toggles carousel movement pause/resume.
- Drag pauses movement and scrubs the tape left/right.
- While movement is paused, visible videos keep playing and image slots keep cycling.
- Preserve the desktop Gallery Carousel behavior.

## Validation

- Focused tests for mobile navigation route insertion.
- Focused tests for mobile carousel settings, portrait gate, close behavior, and landscape player rendering.
- Existing desktop carousel focused tests.
- Targeted lint for touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the mobile nav returns to Create / Jobs / Gallery.

## Result

Implemented for mobile only. Mobile navigation now includes `Carousel` between Jobs and Gallery, the settings screen starts a blocking orientation gate, and landscape mode renders the shared carousel fullscreen with movement-only pause and drag scrubbing.
