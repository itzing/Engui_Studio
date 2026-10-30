---
id: ENGUI-573
title: Paste and replace the image prompt directly from mobile Create
status: Done
assignee: []
created_date: '2026-10-30 11:56'
labels: [mobile, frontend]
dependencies: [ENGUI-569]
---

## Description

Add a second Paste icon beside the Prompt preview on mobile image Create. It must match the editor paste-and-replace behavior without opening the editor or starting a job.

## Acceptance Criteria

- [x] A 44px Paste icon sits on the right of the Prompt card, separate from its editor link.
- [x] Pasting replaces the entire prompt exactly, updates the preview immediately and is retained when opening the editor.
- [x] Empty/denied/unavailable clipboard preserves the prompt and shows English guidance; duplicate reads and stale completions are ignored.
- [x] Selected prompt drafts hide manual paste, matching the editor. Save/Cancel, helper instruction, viewport and gallery behavior remain intact.
- [x] Focused tests, isolated production build, browser checks, owner commit/push and deployment complete; no jobs.

## Plan

See docs/mobile-create-home-prompt-paste.md.

## Completion

73 focused tests and isolated production build pass. WebKit/Chromium each passed 34 scenarios in preview and deployed HTTPS with zero page errors, unexpected API paths or production API writes. The 44px sibling icon fits 320/390px, does not navigate, replaces exact text and preserves it in the editor; late home clipboard reads are ignored after navigation. Editor Save/Cancel, gallery confirmation and standalone iPhone height checks remain passing. Service restarted 2026-10-30 12:01:37 UTC. Previous .next retained under /home/engui/engui-runs/engui-573-20261030/previous.next. No jobs; native iOS clipboard permission UI is not claimed tested by the clipboard fixtures.
