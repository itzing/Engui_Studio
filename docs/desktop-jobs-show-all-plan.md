# Desktop jobs show-all plan

## Goal

Fix the desktop Job View jump caused by loading later pages and returning to the first page during live refresh.

## Product Behavior

- Desktop Job View lists all jobs for the current workspace/filter set in one scrollable list.
- There is no `Load more` button in desktop jobs.
- Refresh and the existing silent refresh update the full visible list instead of resetting to page 1.
- Mobile jobs remain on their dedicated implementation.

## Implementation

1. Replace desktop jobs page fetches with a single jobs fetch using the API's maximum limit.
2. Remove desktop jobs `currentPage`, `hasNextPage`, and `isLoadingMore` state.
3. Remove the desktop `Load more` footer.
4. Preserve merge-by-id behavior so live context updates still patch active jobs.
