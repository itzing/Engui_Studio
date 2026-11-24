# ENGUI-607 — Bake secure MaskFlow endpoint image and retire network cache

## Status

In Progress.

## Authorization and scope

Owner 14818 requests a custom Docker image with all weights/dependencies embedded; the earlier no-build condition applied only to original upstream Engui Qwen. MCP + endpoint only, no desktop/mobile changes. Subsequent owner request explicitly requires deleting `engui-maskflow-model-cache` now, not waiting for image completion. Temporarily disable MaskFlow while replacing its runtime; preserve Krea max6 and final MaskFlow min0/max2. Existing encrypted S3 volume must remain untouched.

## Plan

Bake pinned Qwen2511, MaskFlow adapter/source and locked Python runtime into an immutable Docker image. Offline startup, local model paths only. Verify weights/checksums, offline dependency imports and secure CPU contract tests; publish via existing Docker registry account. Separate model-load, inference and request timings. Promote by image digest, remove bootstrap overrides, keep encryption secrets outside image; prove with one synthetic GPU request. Restore MCP model availability after live proof. Keep old endpoint configuration for diagnosis; old model cache is explicitly disposable and will be deleted at owner's request.

## Validation

Record image digest, pins, size, CPU/offline tests, synthetic live timing, final RunPod allocation and absence of deleted model-cache volume. No user media or unrelated resource deletions.
