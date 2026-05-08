# ENGUI-317 - Use original character preview images in viewer

Status: done

## Request
Character preview images appear cropped in the fullscreen viewer. Use full/original preview images for the viewer and avoid visual cropping in preview cards.

## Scope
- Character Manager preview fullscreen viewer should prefer `imageUrl` over derivative preview/thumbnail URLs.
- Character preview cards should use `object-contain` so full body/upper body previews are not visually cropped inside cards.

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
