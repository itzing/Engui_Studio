# iPad Gallery Viewer Swipe Navigation

## Context

The tablet landscape `/m/gallery` viewer already supports edge taps for previous and next navigation, but horizontal touch swipes do not move between photos. The shared fullscreen viewer treats tablet-width viewports as desktop, which disables the existing mobile swipe gesture handlers.

## Plan

- Add an explicit opt-in for touch swipe navigation to the shared Gallery fullscreen viewer.
- Keep the viewer's desktop-width controls and edge tap zones intact.
- Enable the opt-in only from tablet landscape `/m/gallery`.
- Preserve phone portrait mobile behavior and the desktop Gallery overlay defaults.
- Keep zoomed-in images from triggering swipe navigation.

## Validation

- Add focused tests for the shared viewer's desktop-width touch gesture opt-in.
- Extend mobile Gallery tests to verify the tablet screen passes the opt-in and phone portrait does not.
- Run targeted lint, production build, service restart, and smoke `/m/gallery`.
