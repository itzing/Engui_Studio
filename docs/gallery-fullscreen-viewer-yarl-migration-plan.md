# Gallery Fullscreen Viewer, YARL Migration Plan

## Goal

Replace the current custom `GalleryFullscreenViewer` with a `yet-another-react-lightbox` based implementation without regressing the shared viewer experience used by both gallery and jobs surfaces.

This is not a gallery-only change. The current viewer is shared across:

- desktop gallery flows
- mobile gallery flows
- mobile jobs flows
- desktop overlay flows that reuse the same viewer contract

The migration must preserve the shared core behavior while allowing each host surface to keep its own entry logic and footer actions.

## Why migrate

The current viewer keeps only the active image mounted in the DOM and preloads adjacent items via transient `new Image()` instances.

That design is likely the reason neighboring images disappear after app backgrounding or device lock on mobile. The current approach depends on browser-decoded image cache survival rather than on a viewer implementation that intentionally manages nearby slides.

`yet-another-react-lightbox` is a better fit because it already provides:

- a carousel model with built-in nearby-slide preloading
- mobile-friendly touch navigation
- optional zoom plugin
- optional slideshow plugin
- custom rendering hooks for overlay controls and actions
- a React-native integration model instead of a thin imperative wrapper

## Current source-of-truth usage

Current viewer references found in the codebase:

- `src/components/workspace/GalleryFullscreenViewer.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/layout/DesktopGalleryOverlay.tsx`
- `src/components/mobile/gallery/MobileGalleryScreen.tsx`
- `src/components/mobile/jobs/MobileJobsScreen.tsx`

This means the migration must define:

1. a shared viewer core contract
2. host-specific item mapping and actions
3. which behaviors remain universal vs which remain host-owned

## Current viewer contract

Current shared item shape:

```ts
{
  id: string;
  url: string;
  favorited?: boolean;
  type?: 'image' | 'video' | 'audio';
  bucket?: 'common' | 'draft' | 'upscale';
}
```

Current shared props include:

- `open`
- `items`
- `currentIndex`
- `onIndexChange`
- `onClose`
- `onOpenInfo?`
- `onToggleFavorite?`
- `renderHeaderActions?`
- `renderFooterActions?`

This contract is important because jobs and gallery currently reuse the same viewer shell while supplying different action sets.

## UX features that exist today

The YARL version must explicitly account for every feature below.

### 1. Shared fullscreen shell

Current behavior:

- fullscreen black backdrop
- true viewport overlay
- safe-area aware top and bottom control placement
- no background interaction
- viewer is focusable and handles keyboard events

YARL requirement:

- keep a full-viewport immersive presentation
- keep safe-area aware positioning for custom controls
- ensure no host chrome leaks through on mobile

### 2. Shared index-driven navigation

Current behavior:

- `currentIndex` drives active item
- `onIndexChange` updates host state
- close keeps host selection state alive
- hosts may restore the selected row or tile after close

YARL requirement:

- keep controlled index state
- do not move viewer state ownership into the lightbox internals
- continue to let hosts own selection and restoration behavior

### 3. Mobile swipe navigation

Current behavior:

- swipe left and right navigation is implemented in the custom viewer
- adjacent item navigation is central to the current experience

YARL requirement:

- preserve touch swipe navigation
- ensure the host still receives deterministic index updates

### 4. Keyboard navigation on desktop

Current behavior:

- `Escape` closes the viewer
- `ArrowLeft` navigates backward
- `ArrowRight` navigates forward

YARL requirement:

- preserve keyboard navigation parity on desktop
- confirm no regressions in overlay focus behavior

### 5. Pinch zoom and pan

Current behavior:

- pinch zoom on touch
- pan while zoomed
- zoom state resets when changing slides
- pan is clamped to image bounds

YARL requirement:

- use YARL `Zoom` plugin
- preserve the ability to pinch and pan on mobile
- preserve reset-on-slide-change behavior
- verify whether YARL default pan/zoom behavior is close enough or needs additional wrapper logic

### 6. Single tap toggles overlay controls

Current behavior:

- single tap toggles top and bottom controls
- during slideshow playback, single tap reveals controls instead of toggling arbitrary state

YARL requirement:

- preserve tap-to-show or tap-to-hide controls
- do not leave controls permanently noisy on mobile
- define whether this is implemented through YARL render hooks plus local overlay state

### 7. Double tap favorite toggle with animated feedback

Current behavior:

- double tap toggles favorite when `onToggleFavorite` exists
- favorite action shows a large center-screen heart or unfavorite animation overlay

YARL requirement:

- preserve double-tap favorite on gallery surfaces
- preserve the animated feedback overlay
- allow jobs surface to omit favorite behavior cleanly

### 8. Info entry point

Current behavior:

- top-left info button opens the asset detail flow when available
- on jobs mobile this routes to the job details screen
- on gallery surfaces this opens asset info/details UI

YARL requirement:

- preserve a host-supplied info action
- keep the info button optional
- do not hardcode gallery-only assumptions into the YARL wrapper

### 9. Host-specific header actions

Current behavior:

- the viewer supports host-supplied `renderHeaderActions`
- this allows surfaces to add top-left actions next to Info

YARL requirement:

- preserve a custom header actions slot
- keep it colocated with the shared control overlay logic

### 10. Host-specific footer actions

Current behavior:

- gallery surfaces inject footer actions like draft or upscale bucket moves
- jobs inject footer actions like save draft or add to gallery
- footer actions are conditional on current item state

YARL requirement:

- preserve host-rendered footer action slots
- preserve bottom-right placement
- keep action rendering controlled by the host surface

### 11. Image-loaded state and loading affordances

Current behavior:

- mobile shows a loading spinner near the top before image load
- viewer tracks current image loaded state
- slideshow readiness depends on current slide loaded state

YARL requirement:

- preserve clear loading feedback for mobile
- decide whether YARL built-in loading UI is sufficient or whether a custom loading renderer is needed
- ensure autoplay never advances before the current slide is ready

### 12. Desktop-only slideshow controls

Current behavior:

- slideshow is desktop-only
- modes: stop at end, loop, random
- start and stop button
- interval editor with persisted value
- persisted slideshow mode in localStorage
- countdown status text while active
- controls auto-hide during playback

YARL requirement:

- preserve slideshow only for desktop unless product wants a change
- use YARL `Slideshow` plugin only if it can support current mode and interval requirements
- if YARL plugin is too limited, keep a host-managed slideshow controller layered on top of YARL

Important note:

YARL has slideshow support, but the current implementation includes custom mode semantics and interval persistence. We should not assume plugin parity without testing.

### 13. Safe-area bottom overlays

Current behavior:

- slideshow and footer actions respect bottom safe area
- controls remain reachable on phones with notches and home indicator areas

YARL requirement:

- preserve safe-area aware bottom controls
- do not rely on default library layout if it conflicts with our action placement

### 14. Large-image derived action gating

Current behavior:

- the current viewer computes natural image size
- `canMarkUpscale` depends on image dimensions and type

YARL requirement:

- preserve the ability to compute per-slide capability after load
- provide that state to footer action renderers
- this may require a small wrapper that tracks active slide dimensions separately from YARL itself

### 15. Image fit and immersive presentation

Current behavior:

- active image uses `object-contain`
- fullscreen presentation is intentionally sparse

YARL requirement:

- preserve contain-style presentation
- avoid introducing thumbnail strips, captions, or other chrome unless explicitly requested later

### 16. Shared mixed-media contract

Current behavior:

- item contract already includes `type?: 'image' | 'video' | 'audio'`
- actual current rendering is still centered on image behavior

YARL requirement:

- do not narrow the contract during migration
- first pass may remain image-first, but the wrapper must leave a clear path for custom video or audio slides later

## Feature parity table

| Area | Current custom viewer | YARL target |
| --- | --- | --- |
| Fullscreen overlay | Custom | YARL shell plus custom overlays |
| Nearby preload | Manual `new Image()` | YARL carousel preload |
| Swipe navigation | Custom gestures | YARL native carousel gestures |
| Keyboard nav | Custom | YARL plus verification |
| Pinch/pan | Custom | YARL Zoom plugin |
| Tap overlay toggle | Custom | Custom wrapper state on top of YARL |
| Double-tap favorite | Custom | Custom wrapper gesture handling |
| Info button | Custom | Custom control renderer |
| Header actions | Custom slot | Custom control renderer |
| Footer actions | Custom slot | Custom control renderer |
| Slideshow | Custom desktop controller | Prefer hybrid, not plugin-only assumption |
| Loading UI | Custom mobile spinner | Custom renderer if needed |
| Safe-area layout | Custom | Preserve via wrapper CSS |
| Natural-size gating | Custom `onLoad` state | Wrapper-managed image metadata |

## Recommended architecture

## 1. Keep a shared wrapper component

Do not scatter raw YARL usage across all hosts.

Create a shared wrapper, likely still named something close to:

- `GalleryFullscreenViewer`
- or `SharedMediaLightbox`

Recommendation:

- keep the exported component name `GalleryFullscreenViewer` initially
- replace its internals with a YARL-based implementation
- this minimizes churn in host surfaces

## 2. Keep host-owned state outside the viewer

The following should stay in host components:

- item list building
- current index ownership
- selection restoration behavior
- info-action routing behavior
- gallery bucket mutation actions
- jobs save-to-gallery actions

The viewer wrapper should stay focused on:

- shared lightbox rendering
- shared control chrome
- shared gesture-to-action mapping
- active slide metadata and loading state

## 3. Keep custom overlay state in the wrapper

YARL should provide slide transport and core image behavior.

Our wrapper should continue to own:

- control visibility state
- double-tap favorite logic
- favorite animation overlay
- per-slide loaded state
- derived `canMarkUpscale` state
- slideshow extensions if plugin behavior is insufficient

## 4. Use YARL plugins selectively

Recommended first-pass plugin set:

- `Zoom`
- maybe `Slideshow`, but only after parity check

Do not add extra plugins by default for:

- thumbnails
- captions
- download
- fullscreen

The current viewer is intentionally minimal and custom. Adding plugin chrome would likely regress the UX.

## Entry-point-specific expectations

## Gallery hosts

Shared expectations:

- info button opens gallery asset details
- favorite toggle remains available
- double-tap favorite remains active
- footer actions keep bucket mutations
- adjacent slides should feel more stable after device lock or app backgrounding

Affected hosts:

- `src/components/layout/RightPanel.tsx`
- `src/components/layout/DesktopGalleryOverlay.tsx`
- `src/components/mobile/gallery/MobileGalleryScreen.tsx`

## Jobs host

Expectations:

- info button routes to job details screen
- footer actions remain job-output specific
- favorite behavior can remain absent
- selection restore behavior after close must stay intact

Affected host:

- `src/components/mobile/jobs/MobileJobsScreen.tsx`

## Migration phases

## Phase 1, document and map parity

- confirm all current hosts
- confirm all current shared props
- confirm all required overlays and actions
- decide whether slideshow remains custom or hybrid

## Phase 2, drop-in YARL wrapper

- keep `GalleryFullscreenViewer` public API stable
- swap internal rendering to YARL for image slides
- implement shared custom overlays via YARL render hooks
- preserve current host integrations without changing behavior contracts

## Phase 3, restore critical UX parity

Must-have parity before merge:

- open and close behavior in all hosts
- controlled index updates
- mobile swipe navigation
- desktop keyboard navigation
- top info button
- bottom footer actions
- tap overlay toggle
- zoom and pan
- loading state visibility

## Phase 4, restore advanced polish

- double-tap favorite animation
- desktop slideshow parity
- natural-size-based upscale gating
- any missing safe-area or focus polish

## Technical implementation notes

### Suggested dependency

- `yet-another-react-lightbox`
- `yet-another-react-lightbox/plugins/zoom`
- maybe `yet-another-react-lightbox/plugins/slideshow`

### Suggested wrapper responsibilities

The wrapper should:

- map current viewer items into YARL slides
- keep active index controlled
- expose custom top-left and bottom-right overlays
- maintain local state for overlay visibility
- maintain local state for active slide loaded state
- measure natural image size when needed
- bridge YARL events back to current host callbacks

### Suggested host responsibilities

Hosts should continue to provide:

- `items`
- `currentIndex`
- `onIndexChange`
- `onClose`
- `onOpenInfo`
- `onToggleFavorite`
- `renderHeaderActions`
- `renderFooterActions`

## Risks

### 1. Slideshow parity may not be one-to-one

Risk:

- YARL slideshow behavior may not match our custom desktop modes and interval UX

Mitigation:

- treat slideshow as a separate parity track
- keep custom desktop slideshow orchestration if needed

### 2. Double-tap gesture can conflict with YARL defaults

Risk:

- YARL gesture handling may compete with custom double-tap favorite behavior

Mitigation:

- verify event model early in a spike
- keep favorite toggle in wrapper-level click or pointer handling only if reliable

### 3. Footer and header overlays may drift visually

Risk:

- default YARL layout could fight our current safe-area or overlay positioning

Mitigation:

- use custom render hooks and wrapper CSS instead of default plugin UI chrome

### 4. Jobs flow could regress if migration is treated as gallery-only

Risk:

- jobs viewer has different info routing and footer actions

Mitigation:

- test mobile jobs viewer explicitly as a first-class host

### 5. Natural-size dependent actions may be harder to preserve

Risk:

- the current wrapper relies on direct `img` load metadata

Mitigation:

- add wrapper-managed slide-load metadata collection
- if needed, render a custom image slide wrapper inside YARL instead of using only default image rendering

## Acceptance criteria for the eventual implementation

1. Gallery and jobs continue to use one shared viewer core.
2. Opening the viewer from all existing hosts still works.
3. Mobile swipe navigation remains smooth.
4. Desktop keyboard navigation remains intact.
5. Zoom and pan remain available.
6. Overlay controls still toggle on tap.
7. Gallery double-tap favorite still works with visible feedback.
8. Info action still routes correctly per host.
9. Footer actions still render correctly per host.
10. Mobile lock or background resume behavior is improved for neighboring slides compared with the current implementation.
11. No default YARL chrome is introduced unless explicitly chosen.
12. Jobs-specific flows are verified, not assumed.

## Recommendation

For the eventual implementation, use a hybrid strategy:

- let YARL own carousel, preload, and zoom foundations
- keep Engui-specific interaction chrome in a shared wrapper
- preserve the existing host contract instead of rewriting every caller

That path gives us the best chance of fixing the mobile neighboring-image issue without throwing away the custom UX that the current shared viewer already accumulated.
