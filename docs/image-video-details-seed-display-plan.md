# Image and Video Details Seed Display Plan

## Context

Image and video generation metadata stores the resolved seed, but Job Details and Gallery Details do not expose it as a visible field. This makes prompt wildcard debugging harder, especially for video jobs.

## Plan

1. Add a small metadata helper that reads a finite seed from job options or gallery generation snapshots.
2. Return `seed` from gallery asset list/detail APIs for image and video assets only.
3. Render `Seed` in desktop and mobile Job Details when the job type is image or video and a seed is available.
4. Render `Seed` in desktop and mobile Gallery Details when the asset type is image or video and a seed is available.
5. Add focused API/component regression coverage.

## Rollback

Revert the Engui commit, run `npm run build`, and restart `engui-studio.service`.

