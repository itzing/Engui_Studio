---
id: ENGUI-79
title: Handle Prompt Helper truncation cleanly for long edits
status: Inbox
assignee: []
created_date: '2026-04-16 11:30'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prompt Helper local provider currently uses max_tokens=400 and reports invalid JSON when long model outputs are truncated. Raise max_tokens for long surgical edits and surface explicit truncation errors when finish_reason=length instead of generic JSON parse failure.
<!-- SECTION:DESCRIPTION:END -->
