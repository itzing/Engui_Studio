---
id: ENGUI-223
title: Fix mobile prompt editor Save freeze after textarea edits
status: Inbox
assignee: []
created_date: '2026-05-06 09:07'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users can hit Save in the mobile prompt editor, see the button press animate, but the editor does not close and the mobile UI becomes effectively blocked until the PWA is restarted. Changes are already persisted after restart, which suggests a client-side navigation/focus deadlock rather than a failed save. Investigate the mobile prompt editor route transition after textarea editing and make Save/Cancel navigation resilient on iOS/PWA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Saving from the mobile prompt editor exits back to /m/create reliably after editing the prompt textarea.
- [ ] #2 The app does not get stuck behind a blocked UI state after Save or Cancel from the mobile prompt editor.
- [ ] #3 Existing prompt edits remain preserved when Save succeeds, and Cancel restores the initial draft as before.
<!-- AC:END -->
