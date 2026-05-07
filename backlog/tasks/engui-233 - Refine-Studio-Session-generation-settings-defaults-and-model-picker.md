---
id: ENGUI-233
title: Refine Studio Session generation settings defaults and model picker
status: Superseded
assignee: []
created_date: '2026-05-06 21:51'
labels:
  - studio-sessions
  - desktop
dependencies:
  - ENGUI-232.3
documentation:
  - docs/studio-photo-session-v1-spec.md
  - docs/studio-photo-session-v1-implementation-plan.md
priority: high
---

## Description

Adjust the Studio Session template generation settings UX to match the intended constrained workflow. Replace free-text model entry with a model dropdown defaulting to `zimage`, remove sampler from the visible form, hide steps/cfg/seed behind fixed defaults (`9`, `1`, `-1`), and default the resolution policy to `1024x1536`.

## Acceptance Criteria

- [ ] Studio Session template editor shows a model dropdown instead of free-text modelId input.
- [ ] Default Studio Session model is `zimage`.
- [ ] Sampler is not shown in the Studio Session template editor.
- [ ] Steps/cfg/seed are hidden from the Studio Session template editor and default to `9`, `1`, and `-1` respectively.
- [ ] Default Studio Session resolution is `1024x1536`.

## Superseded note

Superseded by Studio portfolio v1 rewrite (`ENGUI-238` through `ENGUI-259`). Template-first Studio tickets are no longer the product direction.
