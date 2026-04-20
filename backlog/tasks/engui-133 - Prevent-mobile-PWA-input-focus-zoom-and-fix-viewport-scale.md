---
id: engui-133
title: Prevent mobile PWA input focus zoom and fix viewport scale
status: open
priority: high
labels: [mobile, pwa, viewport, ux]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Prevent iOS/mobile PWA auto-zoom when focusing prompt inputs and keep the app locked to a fixed 1:1 viewport scale.

## Acceptance criteria

- [ ] Focusing prompt inputs in PWA does not trigger browser zoom
- [ ] Viewport stays fixed at full-screen scale 1
- [ ] Mobile keyboard handling still works acceptably
- [ ] Build passes and service is restarted
