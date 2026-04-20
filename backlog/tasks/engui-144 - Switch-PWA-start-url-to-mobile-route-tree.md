---
id: engui-144
title: Switch PWA start_url to mobile route tree
status: open
priority: medium
labels: [mobile, pwa, manifest, rollout]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

After the dedicated mobile route tree is complete and validated, switch the installed PWA entry to the new mobile experience.

## Desired outcome

Installed phone PWAs open directly into the route-based mobile app while desktop web continues to use the current desktop entry.

## Acceptance criteria

- [ ] PWA manifest `start_url` points to `/m/create`
- [ ] Installed PWA opens into the mobile route tree
- [ ] Desktop browser entry remains unchanged
- [ ] Rollback steps are documented and low-risk
