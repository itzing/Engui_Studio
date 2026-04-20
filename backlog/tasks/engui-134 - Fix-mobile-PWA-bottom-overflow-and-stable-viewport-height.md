---
id: engui-134
title: Fix mobile PWA bottom overflow and stable viewport height
status: open
priority: high
labels: [mobile, pwa, viewport, layout, ios]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Fix the mobile PWA layout so the bottom navigation stays fully visible and the app height remains stable without overflowing below the visible screen.

## Acceptance criteria

- [ ] Bottom nav remains fully visible on iPhone PWA
- [ ] Main app height matches visible viewport without bottom overflow
- [ ] Keyboard/focus behavior remains acceptable
- [ ] Build passes and service is restarted
