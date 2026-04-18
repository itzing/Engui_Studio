---
id: ENGUI-117
title: Unify gallery selection with viewer cursor
status: Inbox
assignee: []
created_date: '2026-04-18 20:05'
labels: []
dependencies: [ENGUI-114, ENGUI-116]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix gallery restore and tab-switch behavior by making gallery selection and fullscreen viewer navigation use one shared selected asset identity.

Tapping a gallery tile should select that asset. Opening the viewer from a tile should keep that same selection. Navigating inside the viewer should move the same selection. After closing the viewer, the last viewed asset should remain selected, and returning to Gallery should restore around that single selected asset.

Avoid split state between separate sidebar selection and viewer-last-viewed references.
<!-- SECTION:DESCRIPTION:END -->
