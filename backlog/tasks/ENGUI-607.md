# ENGUI-607 — Bake secure MaskFlow endpoint image and retire network cache

## Status

Done.

## Authorization and scope

Owner 14818 requests a custom Docker image with all weights/dependencies embedded; the earlier no-build condition applied only to original upstream Engui Qwen. MCP + endpoint only, no desktop/mobile changes. Subsequent owner request explicitly requires deleting `engui-maskflow-model-cache` now, not waiting for image completion. Temporarily disable MaskFlow while replacing its runtime; preserve Krea max6 and final MaskFlow min0/max2. Existing encrypted S3 volume must remain untouched.

## Plan

Bake pinned Qwen2511, MaskFlow adapter/source and locked Python runtime into an immutable Docker image. Offline startup, local model paths only. Verify weights/checksums, offline dependency imports and secure CPU contract tests; publish via existing Docker registry account. Separate model-load, inference and request timings. Promote by image digest, remove bootstrap overrides, keep encryption secrets outside image; prove with one synthetic GPU request. Restore MCP model availability after live proof. Keep old endpoint configuration for diagnosis; old model cache is explicitly disposable and will be deleted at owner's request.

## Validation

Record image digest, pins, size, CPU/offline tests, synthetic live timing, final RunPod allocation and absence of deleted model-cache volume. No user media or unrelated resource deletions.

## Earlier progress (superseded by verified deployment below)

- Requested cache `engui-maskflow-model-cache` (ttw2b90u62, 100 GB) deleted and verified absent; transport S3 unchanged. RunPod initially retained stale workers; deletion succeeded after asynchronous release following max0 and mount detachment. Endpoint ID retained. MCP availability temporarily disabled; Krea remains available.
- Runtime/image source committed cfaae69 and compact-base follow-up5d920d8. All21CPU protocol/timing tests pass. Docker build runs locally, no GPU rental for building.
- Actual official frozen lock is PyTorch2.13/CUDA13, Diffusers0.39, Transformers5.13.1, despite upstream pyproject's older Torch2.8 declaration. Preserve same proven lock; requireCUDA13 driver. Base is pinned Python3.12 slim; no duplicate PyTorch base runtime.
- Guide-only app change77e11b4 production-built/deployed; publicMCP confirms corrected guide, MaskFlow disabled and Krea configured. Final closure pending image publication and live verification.

Initial validation plan: one synthetic512x512 request with1denoisingstep to verify image startup and encrypted I/O at low cost. Not a quality or50-step speed benchmark. ProductionMCPdefaults remain50steps/CFG4.

## Verified baked-image deployment (2026-11-24)

- Endpoint `dnc6cjeffpqwfy`, immutable image `itzing/qwen-image-edit-maskflow@sha256:db8ff1418f89491c394db4e236eeae1f73862adfa0fe3ef7d126b63c4d1422fe`.
- Source revision `4114a68cb8fa6af1ca88f46d9ebeaa802d620fb2`. The [full base-image CI](https://github.com/itzing/qwen_image_edit_maskflow/actions/runs/45463280197) passed with pinned weights and offline verification. The final runtime/code layers passed 28 offline CPU tests, including real PEFT load/fuse/unload and Triton extension compilation/import. The compiler layer adds 130.14 MB compressed; all model layers are reused. Registry verification proved all base layers unchanged and anonymous pull available. The redundant diagnostic CI run was cancelled after direct-layer publication succeeded.
- All 34 weight/config files (60.17 GB), runtime and licenses are inside the image. No startup model downloads or model-cache mount. Former 100 GB `engui-maskflow-model-cache` was deleted and verified absent; common encrypted transport storage is unchanged.
- Final allocation: MaskFlow min0/max2, Krea2 max6. Model is available through MCP only; desktop/mobile unchanged.
- Four minimal baked-image GPU requests failed during migration. Diagnostics identified offline adapter filename inference and disabled PEFT-0.20 metadata fields unsupported by pinned PEFT-0.19.1. Those were corrected without changing active adapter settings or weights. A fourth request loaded the model/adapter successfully but revealed a missing Triton C compiler; build-essential was then baked in and real offline compilation/import verified locally. After correcting it, a fresh synthetic 512x512, **1-step** GPU smoke test completed; encrypted source, mask, prompt/settings and result roundtrip passed. Model initialization: 30.827s; engine processing/inference: 2.371s; whole handler: 34.847s. Warm model at request start: False.
- Provider queue/startup delay: 59.940s; provider execution: 34.884s. These provider totals are not model-download or pure-inference measurements.
- This short test verifies deployment/encryption, not edit quality or 50-step throughput. Production defaults remain 50 steps / CFG4. Public Showdown MCP passed 10 checks using plans only, without another generation. Synthetic transport objects were removed after local proof was retained.

Evidence: `/home/engui/engui-runs/qwen-maskflow-baked-20261124`; local build/CI evidence: workspace `runs/qwen-maskflow-baked-20261124`. Guide app commit77e11b4 was production-built/deployed as buildGwp7B7F7DHlc_UbqdndSd; final packaging required no second app restart.
