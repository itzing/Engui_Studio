---
id: ENGUI-569
title: Add paste-and-replace icon to the mobile create prompt editor
status: Done
assignee: []
created_date: '2026-10-30 11:19'
labels: [mobile, frontend]
dependencies: []
---

## Description

The owner requests an icon in mobile Create image / Prompt that reads clipboard text and replaces the entire prompt. Desktop is not in scope. Preserve the existing Save/Cancel workflow and the confirmed iPhone viewport fix.

## Acceptance Criteria

- [x] An accessible paste icon appears beside the Prompt label on the mobile manual editor.
- [x] A user click reads clipboard text and replaces the whole prompt, preserving newlines and whitespace.
- [x] Clipboard denial, unavailable API or empty text leaves the existing prompt unchanged with English feedback.
- [x] Save keeps pasted text; Cancel restores the original text; late reads after leaving cannot overwrite state.
- [x] Prompt draft mode is unchanged; no auto-focus, generation jobs, desktop UI or viewport changes.
- [x] Focused tests, isolated production build, browser checks, owner-authored commit/push and service deployment complete.

## Plan

See docs/mobile-prompt-clipboard-paste.md.

## Completion

34 targeted tests and isolated production build pass. Preview and deployed HTTPS checks each pass 23 scenarios per engine (WebKit and Chromium), with zero JavaScript page errors, unexpected API paths or production API writes. Clipboard and permission responses use synthetic fixtures; actual iOS clipboard permission UI is not claimed tested. Service restarted 2026-10-30 11:24:04 UTC; previous build retained for rollback. The standalone iPhone viewport correction is unchanged. No generation jobs launched.
