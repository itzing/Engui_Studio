---
id: engui-135
title: Stabilize iOS PWA viewport height after keyboard and focus
status: open
priority: high
labels: [ios, mobile, pwa, viewport, keyboard]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Use a visualViewport-driven CSS variable so the mobile PWA layout returns to the correct full height after prompt focus, keyboard open/close, and Safari viewport changes.

## Acceptance criteria

- [ ] Mobile PWA root uses a runtime viewport height variable instead of relying only on dvh
- [ ] Bottom area returns to the correct position after input focus/blur and keyboard close
- [ ] Build passes and service is restarted
