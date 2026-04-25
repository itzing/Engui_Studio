---
id: ENGUI-197
title: Fix Prompt Constructor summary fingerprint crash on load and save
status: Done
assignee: []
created_date: '2026-04-25 12:52'
labels:
  - frontend
  - bug
  - qa
dependencies: [ENGUI-190, ENGUI-196]
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the Prompt Constructor desktop crash triggered when loading an existing saved scene or saving a new scene. The current UI computes its dirty-state fingerprint from saved-scene summary rows, but those rows intentionally do not include full `state` or `enabledConstraintIds`. That causes runtime errors once a loaded or newly saved document id matches a summary row. The fix should track the persisted fingerprint from full prompt documents only and add regression coverage for both load and save flows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Loading a saved Prompt Constructor scene from the summary list does not crash when summaries omit full state fields
- [x] #2 Saving a new Prompt Constructor scene does not crash after the summary list reloads
- [x] #3 Dirty-state tracking compares against full persisted documents instead of list summaries
- [x] #4 Regression tests cover both scene load and new scene save flows
<!-- AC:END -->
