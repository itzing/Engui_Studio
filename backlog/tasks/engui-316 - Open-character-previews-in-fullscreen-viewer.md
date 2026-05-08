# ENGUI-316 - Open character previews in fullscreen viewer

Status: done

## Request
In Character Manager, clicking a preview image should open a fullscreen viewer and cycle through all available preview images for that character.

## Scope
- Desktop Character Manager.
- Use existing `GalleryFullscreenViewer`.
- Include all non-empty preview URLs from character preview slots.
- Start viewer on the clicked preview.

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
