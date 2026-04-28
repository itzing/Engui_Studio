# ENGUI-215 - Delete job locally when cancel target is missing upstream

## Summary
If a user tries to cancel a running job but the upstream server no longer has that job, Engui should delete the local job entry instead of marking it as cancelled.

## Scope
- change cancel fallback for missing upstream jobs from local `failed/cancelled` to local deletion
- return explicit API metadata so desktop and mobile UIs can remove the job immediately
- update desktop and mobile cancel handlers to treat this case as a successful delete
- add regression coverage for the cancel route missing-upstream outcome

## Acceptance Criteria
- missing-upstream cancel removes the job locally
- desktop job list/details treat the result as success and remove the job
- mobile job details treat the result as success and navigate back to the jobs list
