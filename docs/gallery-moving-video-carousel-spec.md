# Gallery Moving Video Carousel Spec

## Summary

Add a desktop-only Gallery viewing mode that turns all gallery videos in the current workspace into a pre-shuffled no-repeat moving carousel. The first implementation is a viewer, not a generation workflow. It should feel like an immersive playback surface inside the existing desktop Gallery overlay.

## User Requirements

- Surface: desktop only.
- Source: all gallery videos in the active workspace.
- Repeat behavior: prepare the feed up front without duplicates, then play that feed.
- Motion: video cards move horizontally across a 16:9 scene.
- Mixed orientation: vertical and landscape videos both participate.
- Playback: all videos are muted by default.
- Click behavior: clicking the carousel pauses/resumes all visible playback and the card movement.
- Video end behavior: if a video ends before its card leaves the scene, restart it and keep playing until the card exits.
- Controls: user can regulate card movement speed.

## UX Contract

### Entry Point

The existing desktop Gallery overlay remains the entry point. A `Carousel` control appears in the overlay sidebar. Switching to carousel mode replaces the grid with the moving video scene while keeping the Gallery overlay shell and close behavior.

### Scene

The carousel scene is a 16:9 viewport centered in the available Gallery overlay content area. Cards enter from the left side, move toward the right side, and are removed after fully leaving the scene. New cards appear behind the previous card based on spacing and movement speed.

### Cards

Each card contains exactly one muted looping video. The card aspect ratio is derived from Gallery metadata when available:

- `outputVideoMetadata.width/height`
- top-level `width/height`
- common nested option objects such as `generationOptions`

If metadata is unavailable, the client starts with a vertical fallback ratio and corrects the card once the browser receives video metadata.

### Pause

The carousel has one pause state:

- paused movement
- paused visible video elements
- visible `Paused` status indicator

Clicking the scene toggles this state. Playback resumes from the same card positions and video timestamps.

### Feed End

The feed is considered complete when no unused videos remain and all visible cards have exited the scene. The carousel then shows `End of feed` and a `Shuffle again` action. `Shuffle again` builds a new randomized feed from the same full video set.

## Data Contract

The carousel loads videos through the existing Gallery assets API:

```text
GET /api/gallery/assets?workspaceId=<id>&type=video&bucket=all&sort=newest&limit=100&page=<n>
```

It keeps fetching pages until `pagination.hasNextPage` is false.

The existing route response is extended with optional media fields:

```ts
mediaWidth?: number | null;
mediaHeight?: number | null;
aspectRatio?: string | null;
```

These fields are derived from `generationSnapshot`. No database schema change is required.

## Implementation Plan

1. Add a local backlog ticket for ENGUI-405.
2. Add this spec to `docs/`.
3. Add shared carousel helpers:
   - media dimension normalization
   - aspect-ratio label creation
   - no-repeat Fisher-Yates shuffle
4. Extend Gallery assets list/detail normalization with optional media dimensions.
5. Add `GalleryVideoCarousel` as a desktop component:
   - fetch all workspace videos up front
   - build a shuffled feed
   - animate cards with `requestAnimationFrame`
   - recycle slots only after cards leave the scene
   - pause/resume on scene click
   - keep visible videos muted and looping
   - expose speed control
6. Wire the component into `DesktopGalleryOverlay` as a sidebar-selectable mode.
7. Add focused tests for helpers, API dimensions, and component pause behavior.
8. Validate with focused Vitest, targeted lint, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the feature commit, run production build, restart `engui-studio.service`, and verify the Gallery overlay opens normally.
