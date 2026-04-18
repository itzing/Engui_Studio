---
id: ENGUI-118
title: Restore selected gallery item into viewport on tab return
status: Inbox
assignee: []
created_date: '2026-04-18 20:22'
labels: []
dependencies: [ENGUI-114, ENGUI-116, ENGUI-117]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix Gallery tab switching so the currently selected asset reliably returns into the viewport when the user leaves Gallery, does other work, and then comes back.

If the selected asset is already within the currently loaded virtualized pages, center it in the viewport. If it is outside the loaded page window, rehydrate the Gallery around that selected asset using the existing `focusAssetId` flow instead of leaving the user in an unrelated part of the list.

This must preserve the unified selection model introduced for gallery tiles and fullscreen viewer navigation.
<!-- SECTION:DESCRIPTION:END -->
