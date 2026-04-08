---
id: ENGUI-8
title: Add async auto-tag pipeline for gallery assets
status: Planned
assignee: []
created_date: '2026-04-08 21:02'
labels:
  - gallery
  - backend
  - infra
dependencies: []
documentation:
  - /var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-product-spec.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate autoTags asynchronously from prompt and generation metadata without blocking Add to Gallery.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Auto-tagging is queued separately from asset creation
- [ ] #2 Save flow does not depend on Ollama or other enrichment workers
- [ ] #3 Asset detail can surface pending or completed enrichment state
<!-- AC:END -->
