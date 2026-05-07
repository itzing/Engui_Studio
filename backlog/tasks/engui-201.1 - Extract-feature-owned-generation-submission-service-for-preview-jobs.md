# engui-201.1 - Extract feature-owned generation submission service for preview jobs

## Summary
Refactor generation submission so feature-owned backend routes can create jobs and attach materialization metadata without relying on client-side calls to `/api/generate` as the only integration point.

## Scope
- Extract reusable server-side job submission logic from the current generate route.
- Keep `/api/generate` behavior intact by delegating into the new helper.
- Define the contract for feature-owned preview submission routes.

## Acceptance Criteria
- A shared server-side submission helper exists.
- `/api/generate` uses that helper without behavior regression.
- Feature routes can create preview jobs and enqueue materialization tasks in the same backend flow.
