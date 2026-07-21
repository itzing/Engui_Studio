# ENGUI-421 - Show all desktop jobs without Load more

status: done
labels: [desktop, jobs, right-panel, pagination]

## Goal

Make the desktop Job View show every expected workspace job at once instead of paginating behind a `Load more` button.

## Scope

- Desktop `RightPanel` jobs list only.
- Remove desktop `Load more` behavior and related page state.
- Fetch enough jobs in one request for the expected desktop workload.
- Preserve filters, refresh, live active-job merging, details navigation, delete/cancel/clear actions, and gallery pagination.
- Do not change the dedicated mobile jobs screen.

## Validation

- Focused static/code checks for `RightPanel`.
- Production build, service restart, and desktop route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the desktop jobs panel returns to the previous paginated behavior.

## Result

Implemented for desktop Job View. The desktop `RightPanel` jobs list now requests `/api/jobs` with `all=true`, removes the `Load more` footer, and refreshes the whole visible job list instead of replacing appended pages with page 1. The `/api/jobs` route keeps paged behavior by default for existing clients and returns all matched jobs only when `all=true` is supplied.
