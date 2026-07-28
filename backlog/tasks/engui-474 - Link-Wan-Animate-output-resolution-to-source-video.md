# ENGUI-474 - Link Wan Animate output resolution to source video

Status: done

## Goal

When a user adds a source video in Create -> Wan Animate, initialize the output width and height from that source video's metadata. Let the user scale those dimensions up or down while keeping the source aspect ratio.

## Scope

- Shared desktop and mobile `VideoGenerationForm`.
- Wan Animate only.
- Source video upload and drag/drop paths.
- Existing submit path remains unchanged.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

Implemented in shared `VideoGenerationForm`. Wan Animate source video metadata now initializes output `width` and `height`, linked edits keep the detected aspect ratio, and compact scale controls adjust both dimensions together.
