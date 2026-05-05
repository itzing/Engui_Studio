---
id: ENGUI-220
title: Restore mobile jobs viewer bottom-right actions
status: inbox
priority: high
labels: [mobile, jobs, viewer, regression]
created_at: 2026-05-05
updated_at: 2026-05-05
assignee: openclaw
---

## Summary
Fix the mobile Jobs fullscreen viewer so the bottom-right action buttons reappear consistently after the viewer was moved to the new shared component.

## Acceptance criteria
- [ ] Mobile Jobs viewer shows the bottom-right action buttons again for completed image jobs
- [ ] Top actions (Info/Close) continue to work
- [ ] Action visibility does not depend on a stale image-loading state after navigation
- [ ] Build passes
