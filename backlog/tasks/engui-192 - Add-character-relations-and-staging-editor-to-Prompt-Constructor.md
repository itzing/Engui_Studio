---
id: ENGUI-192
title: Add character relations and staging editor to Prompt Constructor
status: Inbox
assignee: []
created_date: '2026-04-24 16:47'
labels:
  - frontend
dependencies: [ENGUI-189, ENGUI-191]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a dedicated relations and staging editing flow for scene_template_v2 so multi-character scenes can explicitly describe pose relationships, distance, eye contact, contact details, relative placement, and dramatic focus. This work must treat character-to-character structure as first-class data instead of burying it inside a single prose field. The section should stay lightweight for single-character scenes and become a real editing surface as soon as multiple enabled character slots exist.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Users can create, edit, and remove structured relations between character slots
- [ ] #2 Relations support subject, target, relation type, distance, eye contact, body orientation, contact details, relative placement, dramatic focus, and notes
- [ ] #3 The relations section gracefully collapses or downshifts for single-character scenes instead of forcing irrelevant UI
- [ ] #4 Rendered prompts and validation warnings incorporate relation data deterministically
<!-- AC:END -->
