# engui-527 - Preserve gallery video txt2img randomize seed

## Status

Done

## Context

Gallery video assets can be reused with `To txt2img`, but some saved video metadata only carries the source image prompt/model/seed subset. When the original source image job had `randomizeSeed: true`, the txt2img reuse payload can lose that flag and Image Create opens with Randomize disabled.

## Acceptance Criteria

- [x] Gallery video `To txt2img` preserves `randomizeSeed: true` from available source image job metadata.
- [x] Existing gallery video reuse paths that already carry full `sourceImageGenerationSnapshot` metadata remain unchanged.
- [x] Focused regression coverage verifies the restored payload.

## Notes

Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
