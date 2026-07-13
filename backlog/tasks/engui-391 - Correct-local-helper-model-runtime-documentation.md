---
id: ENGUI-391
title: Correct local helper model runtime documentation
status: Done
assignee: []
created_date: '2026-07-13 10:26'
labels:
  - docs
  - automation
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Engui local helper model documentation and weekly model-watch baseline so they record the actual runtime state: text helper script currently launches the qwen2.5-7b-instruct split GGUF while settings still point to Gemma; vision runtime uses Qwen3-VL-8B Abliterated Caption while settings still point to the legacy Qwen2.5-VL-3B name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Docs list the actual text helper script model instead of treating Gemma as the active runtime model.
- [x] #2 Automation baseline/state preserve the factual runtime drift without implying stale docs are canonical.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Factual doc and automation files reviewed against script, settings API, running service, hardware, and cron.
<!-- DOD:END -->

## Final Summary

Corrected the helper model runtime documentation to record the actual text helper script model (`qwen2.5-7b-instruct-q4_k_m` split GGUF) and the stale settings pointer to Gemma. The weekly model-watch baseline/state now treats script/unit/server output as runtime truth and keeps both text-helper and vision-helper settings drift as open facts to monitor.
