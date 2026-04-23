---
id: ENGUI-178
title: Add Prompt Constructor document API and save/load flows
status: Inbox
assignee: []
created_date: '2026-04-23 18:52'
labels:
  - api
  - backend
dependencies: [ENGUI-176, ENGUI-177]
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add the backend API surface for Prompt Constructor documents. The MVP needs template-aware create, list, load, and update flows for PromptDocument records, along with server-side validation of template id/version and structured state shape. The save/load path should preserve enabled constraint ids and document metadata while allowing the rendered prompt to be recomputed from stored state on demand.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The app exposes create, list, load, and update flows for Prompt Constructor documents
- [ ] #2 API handlers validate template identity and reject malformed document state
- [ ] #3 Save and load preserve structured state plus enabled constraint ids without introducing raw prompt edit state
- [ ] #4 The API contract is usable by the desktop Prompt Constructor shell without bespoke one-off transformations
<!-- AC:END -->
