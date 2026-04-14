---
id: ENGUI-74
title: Build image-to-prompt VLM API
status: Todo
assignee: []
created_date: '2026-04-14 13:09'
updated_date: '2026-04-14 13:09'
labels:
  - engui
  - llm
  - vlm
  - api
dependencies:
  - ENGUI-72
  - ENGUI-73
priority: high
---

## Description

Build the backend API for image-to-prompt extraction.

Requirements:
- accept a single image input
- call the dedicated vision prompt helper provider
- return cleaned prompt-oriented text
- optimize system/user prompting for prompt extraction rather than generic Q&A
- keep the API isolated from the existing text prompt helper flow
