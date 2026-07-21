# ENGUI-405 - Add desktop Gallery moving video carousel

status: done
labels: [gallery, desktop, video, viewer]

## Goal

Add a desktop-only Gallery viewing mode that plays all gallery videos as a pre-shuffled no-repeat moving carousel inside a 16:9 scene.

## Scope

- Add a detailed implementation spec in `docs/`.
- Add a desktop Gallery overlay mode reachable from the existing Gallery overlay.
- Load all non-trashed video gallery assets for the active workspace, regardless of current gallery filters.
- Build one randomized feed before playback starts; do not repeat videos within that feed.
- Move mixed-aspect video cards horizontally across a 16:9 scene.
- Keep all videos muted.
- Click the scene to pause/resume both movement and visible video playback.
- Loop a visible video if its playback ends before the card leaves the scene.
- Add a speed slider that controls card movement speed only.
- Show an end-of-feed state and let the user shuffle again.

## Out of Scope

- Mobile UI.
- Audio/unmute controls.
- Opening Gallery Details from the carousel.
- Recommendation ranking or smart sequencing.
- Live RunPod validation jobs.

## Validation

- Unit tests for feed shuffling and media dimension extraction.
- Component tests for loading the carousel and pause/resume behavior.
- Targeted lint/test run.
- Production build, service restart, and route smoke checks.
