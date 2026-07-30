# Mobile Details Navigation Follow-up Plan

## Problem

Mobile Job Details and Gallery Details are standalone routes. After opening details from the mobile list, the user must close details to inspect the next job or gallery asset. Mobile prompt tab persistence also regresses during initial loading because the details route can temporarily fall back to the only available prompt mode before the real item payload arrives.

## Plan

1. Keep prompt tab preference state stable while mobile details are loading.
2. Persist a lightweight snapshot of the currently loaded mobile Jobs and Gallery list order in `sessionStorage`.
3. Add Previous and Next controls to mobile Job Details and Gallery Details.
4. Disable Previous at the start of the list and Next at the end.
5. Resolve missing neighbor ids from the existing paginated list APIs when the neighbor is outside the currently cached snapshot.
6. Add focused helper tests and run the existing targeted validation workflow.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
