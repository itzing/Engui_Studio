# Img2vid Presets Shared Storage Plan

## Problem

Create video/img2vid presets were stored in browser `localStorage`, so presets created on mobile were only available in that mobile browser. Desktop had a separate browser storage and showed no matching preset.

## Approach

Use the existing generic `presets` table as workspace-scoped server storage for Create video presets:

- Store records with `userId = workspaceId`.
- Store records with `type = video-create:<modelId>`.
- Keep the current preset id shape so selected draft references can survive migration.
- Store the preset snapshot in `options` as JSON.
- Preserve `localStorage` only as a legacy migration source.

## Client Behavior

On Create video mount, the shared form loads server presets for the active workspace. If legacy local presets exist on that browser, it sends them to the server once and then clears the legacy local list after a successful sync. Preset create and delete operations use the API so desktop and mobile see the same workspace presets after refresh/remount.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`. Legacy local presets that were cleared after migration will remain available on the server but the reverted client will no longer read them.
