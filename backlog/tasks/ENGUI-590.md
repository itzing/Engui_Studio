---
id: ENGUI-590
title: Preserve Randomize preference when submitting unique-seed image batches
status: Done
assignee: []
created_date: '2026-11-13 12:33'
labels: [create, gallery, mobile, regression]
dependencies: []
---

## Description

Owner14398 authorized fixing the confirmed Randomize metadata loss in mobile image batches. Preserve unique client-selected seeds and the selected Randomize preference independently. Keep desktop single-submit behavior and all existing reuse entry points unchanged. No paid generation tests.

## Acceptance Criteria

- [x] Batch images preserve Randomize=true/false while retaining unique explicit seeds.
- [x] The server does not re-randomize a valid client-selected batch seed; the transport control is not saved as a user preference or forwarded as a model parameter.
- [x] Actual job options and Gallery snapshots retain both the flag and the used seed; To txt2img restores them.
- [x] Regression tests cover both flags, normal single submission, invalid preselected seeds and Gallery reuse.
- [x] Build, browser validation, owner commit/push, deployment and production checks complete without paid jobs.

## Rollback

Retain the previous .next build; restore it and restart engui-studio.service if deployment fails. No database migration or historical metadata rewrite.

## Validation

- 60 regression tests pass across seven files.
- Isolated production build passes.
- Preview: 36 intercepted browser checks pass in Chromium and WebKit, covering desktop, phone and tablet restoration plus single/batch submission.
- Code commit `958150a` pushed under the owner identity and deployed. Production service active; root and mobile Create/Gallery/Jobs return HTTP 200.
- Production: all 36 intercepted browser checks also pass in Chromium and WebKit. No paid generation jobs.
- Previous build retained for rollback. Historical Gallery metadata remains unchanged.
