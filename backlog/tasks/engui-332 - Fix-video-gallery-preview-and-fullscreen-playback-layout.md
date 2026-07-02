# ENGUI-332 - Fix video gallery preview and fullscreen playback layout

Status: done

## Goal

Fix video handling in the gallery so portrait video thumbnails keep the correct visual proportions and fullscreen playback is centered and usable on desktop and mobile.

## Problems

- Portrait video thumbnails/previews are stretched horizontally while image thumbnails render correctly.
- Desktop fullscreen gallery navigation click zones overlap video controls and steal clicks intended to play/pause the video.
- Mobile fullscreen gallery shows videos near the top-left and video playback is not usable.

## Scope

- Generate square video thumbnails with cover/crop behavior instead of distorting source aspect ratio.
- Render fullscreen gallery video in a centered, bounded media container on desktop and mobile.
- Disable invisible desktop previous/next click zones while the active item is a video so native video controls receive pointer input.
- Keep image and audio gallery behavior unchanged.

## Validation

- `npm run build`
- Restart `engui-studio.service` after deployment.
- Local HTTP check after restart.

## Rollback

- Revert the gallery viewer and thumbnail generation changes, then rebuild and restart `engui-studio.service`.
