---
id: ENGUI-78
title: Switch Engui vision helper production model to Qwen3-VL-8B Abliterated Caption
status: Inbox
assignee: []
created_date: '2026-04-15 16:33'
labels:
  - vision
  - models
  - production
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Promote the benchmark winner Qwen3-VL-8B Abliterated Caption to the production Engui vision helper path. Use the validated local benchmark findings and preserve a rollback path to the current configuration. Keep the benchmark project separate for future comparisons.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Adopt Qwen3-VL-8B Abliterated Caption as the production Engui vision helper candidate with validated runtime-compatible model assets.
- [ ] #2 Use stable launch settings on GTX 1060 6GB that survive real Engui extraction requests without CUDA OOM.
- [ ] #3 Update Engui service/script/config references so the production vision helper points to the new model assets and settings.
- [ ] #4 Preserve a clear rollback path to the previous production configuration.
<!-- AC:END -->
