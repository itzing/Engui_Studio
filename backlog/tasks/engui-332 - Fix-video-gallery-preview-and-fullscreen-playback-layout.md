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
- Keep fullscreen gallery navigation available for video items on desktop and mobile.
- Allow the desktop fullscreen viewer to toggle the active video with Space when focus is not inside another control.
- Stop and rewind the active video when leaving it by gallery navigation or closing the viewer.
- Serve generated media files with byte-range support so mobile browsers can play MP4 gallery videos reliably.
- Keep image and audio gallery behavior unchanged.

## Validation

- `npm run build`
- Restart `engui-studio.service` after deployment.
- Local HTTP check after restart.

## Rollback

- Revert the gallery viewer and thumbnail generation changes, then rebuild and restart `engui-studio.service`.
