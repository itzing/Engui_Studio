# Mobile jobs fixed-count refactor plan

## Goal

Replace the current grouped mobile jobs card list with a fixed-count selectable virtual list backed by sparse page loading.

## Scope

- Route: `/m/jobs`
- Keep desktop jobs untouched
- Keep job details route available, but the main mobile interaction becomes list selection plus fullscreen viewer

## Target behavior

- Page size is 10
- Stable total count and absolute indices from API
- First tap selects a job row
- Second tap on the selected row opens the viewer
- Viewer navigation updates selected job
- Returning from viewer restores the row into view
- Toolbar only keeps refresh and clear finished
- Selected row shows overlay actions: delete and upscale
- Prompt text is removed from row content

## Data model

In `useMobileJobsScreen`:

- `totalCount`
- `pageSize`
- `loadedPages`
- `itemsByAbsoluteIndex`
- `selectedJobId`
- `selectedAbsoluteIndex`
- `restoreAbsoluteIndex`
- `restoreTick`

## API changes

Extend `/api/jobs` GET to support:

- `focusJobId`
- `page`
- `limit`
- response `focus.absoluteIndex`

## Rendering model

- Virtual list count is `totalCount`
- Each row index resolves to either a loaded job or a placeholder row
- Range loading uses visible rows and page calculation from absolute indices

## Viewer model

- Build viewer items from loaded completed media jobs
- On viewer index change, update selected job id and absolute index
- On close, restore to selected row
