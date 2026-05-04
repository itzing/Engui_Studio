---
id: ENGUI-219
title: Stop jobs and gallery viewer from wrapping to first loaded item
status: inbox
priority: high
labels: [viewer, gallery, jobs, mobile, desktop, navigation]
created_at: 2026-05-04
updated_at: 2026-05-04
assignee: openclaw
---

## Summary
Fix shared viewer navigation so Gallery and Jobs continue through the full result set instead of jumping back to the first loaded item when the cursor reaches the end of the currently loaded slice.

## Acceptance criteria
- [ ] Gallery viewer advances through the full filtered list on mobile and desktop
- [ ] Jobs viewer advances through the full jobs list on mobile and desktop
- [ ] Reaching the true final item disables further forward navigation instead of wrapping
- [ ] Backward navigation still works correctly
- [ ] Build passes
