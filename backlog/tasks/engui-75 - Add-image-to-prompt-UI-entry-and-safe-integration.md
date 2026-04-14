---
id: ENGUI-75
title: Add image-to-prompt UI entry and safe integration
status: Todo
assignee: []
created_date: '2026-04-14 13:09'
updated_date: '2026-04-14 13:09'
labels:
  - engui
  - llm
  - vlm
  - ui
dependencies:
  - ENGUI-72
  - ENGUI-74
priority: medium
---

## Description

Add a UI entry for the new image-to-prompt flow without breaking the existing text prompt helper.

Requirements:
- expose image-to-prompt as a separate action
- do not replace or mutate the current text helper path
- allow filling the returned text into the current prompt field deliberately
- keep the first UX minimal and reversible
