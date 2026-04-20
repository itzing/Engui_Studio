# Mobile gallery fixed-count refactor plan

## Goal

Replace the current mobile gallery page-window assembly with a fixed-count virtual grid backed by sparse page loading.

## Target model

- Stable `totalCount` from `/api/gallery/assets`
- Stable absolute indices from API `focus.absoluteIndex`
- Sparse cache of loaded pages
- Placeholder tiles for unloaded indices
- Restore by `absoluteIndex`, not by local assembled-window index
- No prepend/append geometry changes in the virtual grid

## State changes in `useMobileGalleryScreen`

Use these primary pieces of state:

- `totalCount`
- `pageSize`
- `loadedPages: Record<number, LoadedGalleryPage>`
- `itemsByAbsoluteIndex: Record<number, MobileGalleryAsset>`
- `selectedAssetId`
- `selectedAbsoluteIndex`
- `restoreAbsoluteIndex`
- `restoreTick`

Derived helpers:

- `assetIndexMap: Record<string, number>`
- `loadedAssets` sorted by absolute index
- `getAssetAtIndex(index)`
- `ensureRangeLoaded(startIndex, endIndex)`

## Loading model

- Initial hydrate asks `/api/gallery/assets` with optional `focusAssetId`
- Use API `pagination.totalCount` and `focus.absoluteIndex`
- Load the focus page and adjacent pages, but do not assemble a flat source-of-truth array
- Populate `itemsByAbsoluteIndex` using absolute offsets from each page response
- Virtualizer count becomes `totalCount`

## Virtual rendering model

- 3-column grid
- `rowCount = Math.ceil(totalCount / 3)`
- Each absolute index maps to either:
  - loaded real tile
  - unloaded placeholder tile
- Range loading is driven by visible rows, not prepend/append mutations

## Restore rules

- Ordinary selection tap only updates selection state
- Restore scroll only happens on:
  - initial hydrate with saved selection
  - returning from viewer
- Restore targets `restoreAbsoluteIndex`
- After restore, clear/consume the restore flag behaviorally

## Benefits

- No top prepend jump
- No post-restore drift from page insertion
- No jump back to previously selected tile when tapping a new loaded tile
- Stable virtual geometry during upward and downward browsing
