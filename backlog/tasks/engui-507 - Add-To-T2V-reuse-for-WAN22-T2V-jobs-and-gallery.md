# ENGUI-507 - Add To T2V reuse for WAN22 T2V jobs and gallery

## Status

Done

## Problem

WAN22 T2V jobs and gallery video assets preserve generation metadata, but Jobs and Gallery only expose image-oriented reuse actions such as `To txt2img` and `To img2vid`. Users need a direct `To T2V` action that restores the saved T2V prompt and metadata into Create Video with the `wan22-t2v` model selected.

## Acceptance Criteria

- [x] Jobs expose `To T2V` for WAN22 T2V video results.
- [x] Gallery details expose `To T2V` for WAN22 T2V video assets.
- [x] The reuse payload restores prompt/options into the `video` workflow draft for `wan22-t2v` without carrying image/video input paths.
- [x] Desktop, mobile, and tablet reuse surfaces are covered where the existing Jobs/Gallery reuse controls appear.
- [x] API and draft persistence tests cover the new reuse action.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
