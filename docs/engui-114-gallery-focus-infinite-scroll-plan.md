# ENGUI-114 Implementation Plan

## Goal

Make Gallery return to the area around the last viewed asset after closing the fullscreen viewer, instead of resetting the user back to page 1.

The restored gallery should support browsing both upward and downward from that point, preserve a clear visual selection on the last viewed asset, and avoid scroll jumps while limiting image memory usage.

## Non-Goals

Out of scope for this milestone:

- explicit back-to-origin UI for Create, Preview, or Jobs
- automatic reopening of the fullscreen viewer when Gallery is revisited
- URL-deep-linking of gallery viewer state
- full virtualization rewrite of the gallery grid

## Problem Summary

Today the gallery viewer can be closed only back into the current gallery list state, which effectively sends the user back to the initial loaded page. That breaks continuity when the user was browsing far from the top of the gallery.

A simple page jump is not sufficient because the current gallery uses bottom-only `Load more`. If the user lands directly on a later page, they cannot continue upward through the list. The list therefore needs a bidirectional paged window rather than a single forward-only pagination flow.

## Chosen Approach

Use a focus-anchored gallery restore flow:

1. The backend accepts `focusAssetId` on the gallery list endpoint together with the active gallery query state.
2. The backend resolves which page contains that asset after filters, search, sort, and page size are applied.
3. The frontend initializes the gallery around that resolved page instead of page 1.
4. The gallery becomes a bidirectional infinite-scroll window.
5. Neighboring pages are prefetched in the background.
6. Pages outside a moving `±3` retention window keep their page shell but drop only thumbnail/image content.

This gives correct restoration behavior without overengineering origin-aware navigation.

## API Changes

## 1. Extend gallery list request

Endpoint:

- `GET /api/gallery/assets`

Add query parameter:

- `focusAssetId?: string`

The parameter must be interpreted under the same active gallery query state as the normal list request:

- filters
- search
- sort
- page size
- trash/favorites/type filters or any current query dimensions already supported by the endpoint

## 2. Resolve focus metadata on the backend

When `focusAssetId` is present:

- run the same filtered and sorted query logic used by the gallery list
- determine whether the asset exists in the current result set
- if found, compute:
  - resolved page
  - index on page
  - absolute index in the filtered result set

Suggested response shape:

```ts
{
  items: GalleryAsset[];
  page: number;
  pageSize: number;
  total: number;
  focus?: {
    assetId: string;
    found: boolean;
    page: number | null;
    indexOnPage: number | null;
    absoluteIndex: number | null;
  };
}
```

Behavior:

- if `focusAssetId` is found, return the data for the resolved page rather than the originally requested page
- if it is not found, fall back gracefully to normal pagination behavior and return `focus.found = false`

## Frontend State Model

Introduce a page-window state for Gallery rather than a single append-only list.

Suggested state shape:

- `selectedAssetId: string | null`
- `lastViewedAssetId: string | null`
- `loadedPages: Map<number, GalleryPageRecord>`
- `anchorPage: number`
- `lowestLoadedPage: number`
- `highestLoadedPage: number`
- `isLoadingNextPage: boolean`
- `isLoadingPreviousPage: boolean`
- `focusResolved: boolean`

Suggested page record shape:

- `page: number`
- `items: GalleryAsset[]`
- `imagesHydrated: boolean`
- `status: 'idle' | 'loading' | 'ready' | 'error'`

Important rule:

- cleanup must never remove the page record itself, only the thumbnail/image payload used for rendering

## Viewer Close Flow

On every viewer navigation step:

- keep `lastViewedAssetId` updated to the asset currently shown in the viewer

On viewer close:

1. save `selectedAssetId = lastViewedAssetId`
2. request gallery data with current query state plus `focusAssetId = lastViewedAssetId`
3. initialize or reposition the gallery page window around `focus.page` if found
4. render the gallery with the focused asset visibly selected
5. keep graceful fallback if the asset is no longer part of the current query result

## Infinite Scroll Plan

## 1. Bidirectional window

Replace bottom-only `Load more` with bidirectional infinite scroll.

Required behaviors:

- if the user scrolls downward near the bottom edge, load the next page
- if the user scrolls upward near the top edge, load the previous page
- initial load may start from page 1 or from the resolved focus page

## 2. Sentinels

Use separate top and bottom sentinels:

- top sentinel triggers `page - 1` when available
- bottom sentinel triggers `page + 1` when available

Protect against duplicate in-flight loads.

## 3. Scroll stability

When prepending an earlier page:

- preserve the user’s visible scroll position
- compensate for the inserted content height before the browser paints the new frame if necessary

## Background Prefetch

After the anchor page is loaded:

- prefetch neighboring pages at low priority
- aim to keep pages within `±3` of the current anchor/visible region warm

Suggested order:

1. immediate neighbors `-1` and `+1`
2. then expand toward `-2`, `+2`, `-3`, `+3`

This should be opportunistic and cancel-safe if the user changes filters or sort.

## Image-Only Cleanup Strategy

To limit memory without causing layout jumps:

- keep page shells and item positions for all loaded pages still represented in the current page window
- for pages farther than `±3` from the current visible anchor, clear only image/thumbnail content
- retain enough metadata to reconstruct the thumbnails when that page returns into the active window

Practical implementation options:

- keep the item records but clear `thumbnailUrl` / hydrated image state
- render placeholders or empty shells with preserved dimensions
- rehydrate image content when the page re-enters the retention window

Do not:

- delete page records entirely during normal cleanup
- collapse page heights in a way that changes scroll geometry unexpectedly

## Selection and UX Polish

After closing the viewer:

- the last viewed asset should remain selected in the gallery
- selected styling should be noticeably stronger than hover or favorite states

Recommended visual changes:

- stronger ring or border
- slightly brighter tile background or overlay treatment
- subtle shadow or scale emphasis

The selected state must survive page-window updates and background prefetch.

## Fallback Rules

If `focusAssetId` is missing from the current result set because of changed filters, search, sort, or asset removal:

- do not crash or reset the entire gallery state
- fall back to the normal list response
- preserve a usable gallery position
- clear stale selected state if needed

## Implementation Order

## Phase 1: Backend focus resolution

- extend `GET /api/gallery/assets` with `focusAssetId`
- compute resolved focus page and metadata
- return focused page results when found
- add basic response validation/logging

## Phase 2: Frontend page-window foundation

- replace append-only gallery paging state with a page-window structure
- support initial load from arbitrary page
- preserve current filters/search/sort wiring

## Phase 3: Viewer-close restore

- track `lastViewedAssetId`
- on viewer close, reload gallery around `focusAssetId`
- keep focused asset selected

## Phase 4: Bidirectional infinite scroll

- add top and bottom sentinels
- load previous/next pages on demand
- maintain scroll stability when prepending pages

## Phase 5: Prefetch and cleanup

- add low-priority neighboring-page prefetch
- implement image-only cleanup outside the `±3` window
- verify that scroll geometry remains stable

## Phase 6: UX polish and QA

- strengthen selected-asset styling
- verify viewer close behavior with active filters/search/sort
- verify focus-not-found fallback
- verify repeated back-and-forth browsing without state drift

## Validation Checklist

- closing viewer no longer resets gallery to page 1 by default
- gallery can initialize around the page resolved by `focusAssetId`
- user can continue browsing both upward and downward from that point
- infinite scroll works in both directions
- neighboring pages prefetch without breaking filters or sort
- pages outside the retention window drop only image content
- scroll position remains stable during prepend/load/cleanup flows
- the last viewed asset remains visibly selected after viewer close

## Likely Touch Points

Potential files to inspect and update:

- `src/app/api/gallery/assets/route.ts`
- `src/components/layout/RightPanel.tsx`
- `src/components/workspace/GalleryFullscreenViewer.tsx`
- any shared gallery list or gallery state hooks used by the right panel

Final implementation details should follow the actual current source of truth found in the existing gallery data flow.
