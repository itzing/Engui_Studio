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
- Click behavior: clicking the carousel pauses/resumes card movement only; visible videos and image slots keep playing/cycling.
- Video end behavior: if a video ends before its card leaves the scene, restart it and keep playing until the card exits.
- Controls: user can regulate card movement speed.
- Images: an `Images` checkbox is available in the carousel header, off by default.
- Image insertion: when Images is enabled, the carousel inserts one image slot after every two video slots.
- Image slot content: each image slot preselects five gallery images when enough images are available.
- Image refresh: image slots switch to the next selected image every second while the slot is visible, including while card movement is paused.
- Rebuild behavior: toggling Images on or off rebuilds the carousel feed from scratch.

## UX Contract

### Entry Point

The existing desktop Gallery overlay remains the entry point. A `Carousel` action appears in the overlay sidebar. Activating it opens the moving video scene in a fullscreen modal above the Gallery overlay instead of replacing the Gallery grid content area. Closing the carousel returns the user to the same Gallery overlay state.

### Scene

The carousel scene is a 16:9 viewport centered in the available Gallery overlay content area. Cards enter from the left side, move toward the right side, and are removed after fully leaving the scene. New cards appear behind the previous card as an edge-to-edge chain, with only a tiny overlap to avoid subpixel seams; there should be no intentional black gap between consecutive cards.

### Cards

Video cards contain exactly one muted looping video. Image cards contain one preselected image slot that cycles through up to five images. Cards fill the full height of the 16:9 scene. Card width is derived from the media aspect ratio, so short or landscape media scales up to scene height without distorting its proportions. The card aspect ratio is derived from Gallery metadata when available:

- `outputVideoMetadata.width/height`
- top-level `width/height`
- common nested option objects such as `generationOptions`

If metadata is unavailable, the client starts with a vertical fallback ratio and corrects the card once the browser receives video metadata.

For image slots, the carousel groups images by similar dimensions/aspect ratios before playback starts. The slot uses the median aspect ratio of the selected image group so its width remains stable while the displayed image changes once per second.

### Pause

The carousel has one pause state:

- paused movement
- visible video elements keep playing
- visible image slots keep cycling once per second
- visible `Paused` status indicator

Clicking the scene toggles this state. Movement resumes from the same card positions; visible videos and images continue their own playback/cycling while the tape is frozen.

### Close

The fullscreen carousel modal closes through its header close action or the Escape key. Escape closes only the carousel modal when it is open; it should not close the underlying Gallery overlay in the same keypress.

### Feed End

The feed is considered complete when no unused videos remain and all visible cards have exited the scene. The carousel then shows `End of feed` and a `Shuffle again` action. `Shuffle again` builds a new randomized feed from the same full video set.

## Data Contract

The carousel loads videos through the existing Gallery assets API:

```text
GET /api/gallery/assets?workspaceId=<id>&type=video&bucket=all&sort=newest&limit=100&page=<n>
```

When Images is enabled, it also loads images through the same API:

```text
GET /api/gallery/assets?workspaceId=<id>&type=image&bucket=all&sort=newest&limit=100&page=<n>
```

It keeps fetching pages until `pagination.hasNextPage` is false for each requested media type.

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
   - mixed video/image feed construction
   - image-slot grouping by similar dimensions/aspect ratios
4. Extend Gallery assets list/detail normalization with optional media dimensions.
5. Add `GalleryVideoCarousel` as a desktop component:
   - fetch all workspace videos up front
   - build a shuffled feed
   - animate cards with `requestAnimationFrame`
   - recycle slots only after cards leave the scene
   - pause/resume card movement on scene click
   - keep visible videos muted and looping
   - expose speed control
   - expose Images checkbox, default off
   - insert image slots after every two videos when enabled
   - cycle each image slot every second, even while card movement is paused
6. Wire the component into `DesktopGalleryOverlay` as a sidebar-selectable mode.
7. Add focused tests for helpers, API dimensions, and component pause behavior.
8. Validate with focused Vitest, targeted lint, `git diff --check`, Prisma validate, production build, service restart, and smoke checks.

## Rollback

Revert the feature commit, run production build, restart `engui-studio.service`, and verify the Gallery overlay opens normally.
