---
id: engui-145
title: Run iPhone PWA QA and desktop regression pass
status: done
priority: high
labels: [mobile, pwa, qa, desktop]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

Run a focused QA pass on the new route-based mobile PWA, plus a desktop regression pass to verify the milestone did not degrade the current desktop experience.

## Desired outcome

The mobile route tree is validated on iPhone PWA and desktop parity is explicitly confirmed before the PWA entry point is switched.

## Acceptance criteria

- [x] iPhone PWA keyboard and focus flows are tested
- [x] Safe-area and orientation behavior are tested
- [x] Mobile route navigation is tested end-to-end
- [x] Draft persistence is tested across mobile routes
- [x] Desktop regression pass confirms no intentional UX change
- [x] Follow-up bugs are either fixed or captured as separate tickets

## Completion notes

Completed a focused local QA/regression pass for the route-based mobile tree before switching the PWA entry point. Verified route availability for `/`, `/m/create`, `/m/create/prompt`, `/m/create/advanced`, `/m/create/scenes`, `/m/create/model`, `/m/preview`, `/m/jobs`, `/m/jobs/[id]`, `/m/gallery`, and `/m/gallery/[id]`; added targeted automated coverage for create-draft persistence and gallery detail payload normalization; and regression-checked existing job detail output normalization tests. During QA, fixed iPhone focus-zoom risks by raising mobile editable controls to 16px-equivalent sizing on phone routes, fixed tag-input hydration in mobile gallery details, and upgraded mobile job details so “Open in Create” now dispatches the real reuse payload instead of doing a plain route jump. Desktop remained unchanged in this pass outside shared API/mobile-safe behavior.

