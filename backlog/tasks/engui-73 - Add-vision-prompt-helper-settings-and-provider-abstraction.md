---
id: ENGUI-73
title: Add vision prompt helper settings and provider abstraction
status: Todo
assignee: []
created_date: '2026-04-14 13:09'
updated_date: '2026-04-14 13:09'
labels:
  - engui
  - llm
  - vlm
  - settings
dependencies:
  - ENGUI-72
priority: high
---

## Description

Add a separate settings and provider abstraction layer for the new image-to-prompt VLM flow.

Requirements:
- keep the existing text prompt helper untouched
- add a dedicated `visionPromptHelper` config branch
- support local OpenAI-compatible multimodal providers
- include connection testing
- document the intended first model as Qwen2.5-VL-3B-Instruct-GGUF
