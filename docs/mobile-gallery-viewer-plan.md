# Mobile Gallery Viewer Plan

## Goal

Make gallery image browsing comfortable in a mobile browser.

The current gallery flow requires opening each image into the center panel and does not provide a true fullscreen browsing experience. The new flow should let the user browse filtered gallery items in a dedicated fullscreen viewer with minimal UI.

## Product Decision

### Final interaction model

- Tapping an image in the gallery opens a fullscreen viewer.
- The viewer uses the current filtered and sorted gallery result set.
- The viewer is intentionally minimal and shows only:
  - the image
  - a close button
- Image metadata and details are **not** shown inside the viewer.
- Image details remain accessible from the center panel.
- Add an explicit **Info** button on the main image in the center panel to open the existing detail dialog.

### Navigation inside the viewer

Required:
- tap on left half of the screen -> previous image
- tap on right half of the screen -> next image

Optional second step:
- swipe left/right navigation, only if it is reliable and does not complicate the first release

## Scope

### In scope

- fullscreen image viewer modal/lightbox
- open viewer from gallery tap
- browse current filtered gallery set
- left/right tap navigation
- close button
- Info button on center panel image
- preserve current gallery filters and sort order when entering viewer

### Out of scope for first release

- zoom/pinch
- visible metadata inside viewer
- action bar inside viewer
- favorite/trash/reuse buttons inside viewer
- slideshow/autoplay
- keyboard-only desktop polish beyond basic support
- deep linking viewer state into URL

## UX Requirements

### Gallery behavior

Current:
- tap on gallery item opens details flow

New:
- tap on gallery item opens fullscreen viewer
- viewer opens on the tapped item within the current filtered list

### Fullscreen viewer behavior

The viewer should:
- cover the full viewport
- use a dark background
- center the image with `object-contain`
- respect mobile safe areas
- prevent accidental background interaction
- show only a close button as persistent UI

The viewer should not show:
- title
- prompt
- metadata
- action buttons
- thumbnail strip
- captions
- center-panel chrome

### Viewer navigation behavior

- tap in left 35-40% zone -> previous image
- tap in right 35-40% zone -> next image
- center zone should do nothing for now
- if at first image, previous tap does nothing
- if at last image, next tap does nothing

### Exit behavior

- close button dismisses viewer
- closing returns user to the gallery view
- underlying gallery state remains unchanged
- scroll position should remain stable if possible

### Center panel behavior

- current center panel remains the place for working with a selected image
- add an **Info** button directly on or above the large preview image
- tapping **Info** opens the existing asset detail dialog

## Technical Implementation Plan

## 1. Identify and reuse current gallery source of truth

Likely relevant components:
- `src/components/layout/CenterPanel.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/workspace/GalleryAssetDialog.tsx`
- `src/lib/context/StudioContext.tsx`

Tasks:
- identify where filtered and sorted gallery items are computed today
- identify how selected gallery asset is represented in state
- avoid duplicating gallery filtering logic inside the viewer

Implementation principle:
- viewer must receive the already filtered/sorted asset list from existing UI state
- avoid recomputing a second independent list if possible

## 2. Add viewer state

Add minimal state for fullscreen browsing.

Suggested state shape:
- `isGalleryViewerOpen: boolean`
- `galleryViewerItems: GalleryAsset[]`
- `galleryViewerIndex: number`

Alternative:
- store only IDs plus index if that better matches existing state

Requirements:
- the state should open from any gallery item in the currently visible list
- the state should not overwrite the existing center-panel selection logic unless explicitly intended

## 3. Create a dedicated fullscreen viewer component

Suggested new component:
- `src/components/workspace/GalleryFullscreenViewer.tsx`

Responsibilities:
- render fullscreen overlay/modal
- render current image
- render close button
- handle left/right tap navigation
- optionally support swipe later

Suggested props:
- `open`
- `items`
- `currentIndex`
- `onIndexChange`
- `onClose`

Implementation notes:
- use existing dialog/modal primitives only if they allow true fullscreen mobile rendering without extra chrome
- otherwise create a custom fixed-position overlay component

## 4. Change gallery tap behavior

Current gallery tap opens details.

New behavior:
- tapping a gallery image should call `openGalleryViewer(filteredItems, tappedIndex)`

Important:
- this should use the exact currently visible filtered list
- viewer index must correspond to the tapped card within that list

## 5. Preserve details access through center panel Info button

Add an explicit **Info** button to the main preview area in the center panel.

Behavior:
- opens the same detailed asset dialog currently used for gallery-item details
- works for the image currently displayed in the center panel

Implementation note:
- do not overload the fullscreen viewer with details UI
- keep details workflow outside viewer by design

## 6. Navigation input handling

### First-release implementation

Implement navigation by screen tap zones.

Suggested approach:
- wrap fullscreen image area in a container
- on tap/click, compute horizontal position relative to container width
- left zone -> previous
- right zone -> next

Edge handling:
- clamp index to valid bounds
- no wraparound unless explicitly desired later

### Optional second phase

If later added:
- pointer/touch tracking for swipe gestures
- threshold-based horizontal swipe only
- ensure swipe does not conflict with vertical browser gestures too aggressively

## 7. Performance considerations

To keep viewer smooth on mobile:
- reuse already loaded gallery URLs where possible
- preload adjacent image URLs if cheap
- avoid large rerenders across the whole gallery when navigating viewer
- avoid expensive metadata rendering inside viewer

## 8. Accessibility and fallback behavior

Basic requirements:
- close button must be easy to reach and sufficiently large
- support `Escape` to close on desktop
- support arrow keys left/right on desktop if trivial
- maintain focus safely when dialog opens/closes if using modal primitives

## 9. Rollout order

### Phase 1, recommended

- fullscreen viewer component
- open from gallery tap
- use filtered item list
- left/right tap navigation
- close button
- center panel Info button

### Phase 2, optional

- swipe navigation
- keyboard polish
- image prefetch improvements
- subtle hide/show controls behavior if needed

## File-level Change Plan

### Likely files to modify

- `src/components/layout/CenterPanel.tsx`
  - add Info button on main image area
  - wire existing details dialog opening from explicit button

- `src/components/layout/RightPanel.tsx`
  - if gallery items are rendered here, update tap behavior to open viewer
  - pass current filtered items and tapped index

- `src/components/workspace/GalleryAssetDialog.tsx`
  - possibly reuse existing details logic only
  - do not make this the fullscreen viewer if it carries too much metadata/UI

- `src/lib/context/StudioContext.tsx`
  - add viewer state only if global state is the cleanest place
  - otherwise keep viewer state local to the gallery owner component

### Likely new file

- `src/components/workspace/GalleryFullscreenViewer.tsx`

## Risks

1. Gallery tap currently may be tied deeply to selection/details logic
- mitigation: isolate fullscreen open logic and keep center-panel details explicit via Info button

2. Filtered item ordering may be derived in multiple places
- mitigation: viewer must consume one canonical visible list from current gallery UI state

3. Mobile modal implementation may leave visible app chrome or scroll bleed
- mitigation: use fixed fullscreen overlay with scroll lock and safe-area aware close button placement

4. Swipe can introduce gesture bugs
- mitigation: ship tap navigation first

## Acceptance Criteria

1. In mobile browser, tapping a gallery image opens a fullscreen viewer.
2. The viewer opens on the tapped image from the currently filtered gallery set.
3. The viewer shows only the image and a close button.
4. Tapping left/right areas navigates to previous/next image.
5. Closing the viewer returns the user to the gallery without losing gallery state.
6. Image details remain accessible from the center panel through an explicit Info button.
7. Existing filtering and sorting continue to determine which items are browsable in the viewer.

## Recommendation

Implement Phase 1 only for the first delivery.

That gives the main usability win quickly and keeps the fullscreen viewer truly clean. Swipe can be added afterward if the tap-based viewer already feels good in real mobile use.
