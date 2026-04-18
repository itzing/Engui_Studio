---
id: ENGUI-115
title: Keep loaded gallery tile previews visible after virtualized scroll
status: Inbox
assignee: []
created_date: '2026-04-18 19:37'
labels: []
dependencies: [ENGUI-114]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix the gallery grid regression introduced during the `react-virtuoso` migration where already loaded tiles can turn back into black placeholders after the grid settles or the user scrolls slightly.

The virtualized grid should keep previews visible for any page that has already been loaded, instead of re-applying the old image-retention placeholder behavior that was designed for the non-virtualized implementation.

Preserve the current desktop/mobile gallery behavior, including viewer open/close restoration, selected-tile highlight, overlay actions, and bidirectional page loading.
<!-- SECTION:DESCRIPTION:END -->
