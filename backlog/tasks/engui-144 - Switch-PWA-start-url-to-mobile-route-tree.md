---
id: engui-144
title: Switch PWA start_url to mobile route tree
status: done
priority: medium
labels: [mobile, pwa, manifest, rollout]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary

After the dedicated mobile route tree is complete and validated, switch the installed PWA entry to the new mobile experience.

## Desired outcome

Installed phone PWAs open directly into the route-based mobile app while desktop web continues to use the current desktop entry.

## Acceptance criteria

- [x] PWA manifest `start_url` points to `/m/create`
- [x] Installed PWA opens into the mobile route tree
- [x] Desktop browser entry remains unchanged
- [x] Rollback steps are documented and low-risk

## Completion notes

Completed by switching `src/app/manifest.ts` from `start_url: '/'` to `start_url: '/m/create'` while keeping desktop browser entry `/` unchanged. Local verification confirmed `/`, `/m/create`, and `/manifest.webmanifest` still return HTTP 200 and the served manifest now reports `start_url: /m/create`. Rollback remains low-risk: change `start_url` back to `/`, rebuild, restart `engui-studio.service`, and re-verify the manifest payload.

