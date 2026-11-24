# Qwen Image Edit 2511 + MaskFlow (MCP only)

Endpoint source: https://github.com/itzing/qwen_image_edit_maskflow

MCP 2.1 exposes the dedicated model `qwen-image-edit-maskflow`, mode `masked_image_edit`. Desktop/mobile and ordinary Qwen are unchanged. Exactly one source reference and a separate mask are required. Reconnect your MCP client to refresh discovery and tool schemas.

## Prepare a plan

Replace the asset ID and request key. Inspect the frozen plan before starting a paid generation.

```json
{
  "modelId": "qwen-image-edit-maskflow",
  "mode": "masked_image_edit",
  "prompt": "Replace the selected object with a red sphere. Keep the surrounding scene unchanged.",
  "references": [{"kind": "gallery_asset", "assetId": "REAL_SOURCE_ASSET_ID"}],
  "mask": {"kind": "rectangles", "regions": [{"x": 0.25, "y": 0.25, "width": 0.5, "height": 0.5}]},
  "width": 1024,
  "height": 1024,
  "variantCount": 1,
  "seeds": [42],
  "parameters": {"steps": 50, "guidance": 4},
  "requestKey": "REPLACE_WITH_A_NEW_UUID"
}
```

Alternatively, use an image mask:

```json
{"kind": "image", "source": {"kind": "gallery_asset", "assetId": "REAL_MASK_ASSET_ID"}}
```

Existing job outputs are also supported as media references. A mask image must be opaque grayscale and match the source dimensions after EXIF orientation normalization: white edits, black preserves, gray softens. Rectangle coordinates are normalized to 0..1 against the full source; up to 32 rectangles are combined. There is no automatic text segmentation, and a second ordinary reference is not a mask.

## Behavior and limits

- Maximum output: 1 megapixel; each side 256..2048, a multiple of 64. Source and mask are resized together. Match the source aspect ratio to avoid distortion.
- Official latest general-scene SFT adapter, 50 steps, CFG 4, Soft-Poisson. No Lightning, implicit distillation or user LoRA support.
- Source and mask hashes and geometry are frozen in the plan and rechecked before start/dispatch. Changed or deleted media invalidates the plan. For reuse, prepare a new request from `snapshot.draft`.
- Use batch phases, counts and `pollAfterSeconds`; `configured=true` does not mean a warm worker. Never blindly retry an uncertain submission.

## Secure deployment

Prompt, authenticated generation settings, source, mask and output use Engui AES-256-GCM v1 with job/model/attempt/direction/role bindings. There is no plaintext fallback. Secrets are outside Git. Public model weights and runtime are baked into the endpoint image; each worker runs one generation at a time.

The new deployment uses a self-contained Docker image with pinned weights and runtime. Startup is offline for model assets, with no network model-cache volume. The old 100 GB cache was deleted on owner request. Cold starts may still pull image layers and load weights into GPU memory. Endpoint allocation is 0 minimum / 2 maximum 96 GB workers. The baked image is deployed and MaskFlow is available in MCP (ENGUI-607).

## Verified baked-image deployment (2026-11-24)

- Endpoint `dnc6cjeffpqwfy`, immutable image `itzing/qwen-image-edit-maskflow@sha256:db8ff1418f89491c394db4e236eeae1f73862adfa0fe3ef7d126b63c4d1422fe`.
- Source revision `4114a68cb8fa6af1ca88f46d9ebeaa802d620fb2`. The [full base-image CI](https://github.com/itzing/qwen_image_edit_maskflow/actions/runs/45463280197) passed with pinned weights and offline verification. The final runtime/code layers passed 28 offline CPU tests, including real PEFT load/fuse/unload and Triton extension compilation/import. The compiler layer adds 130.14 MB compressed; all model layers are reused. Registry verification proved all base layers unchanged and anonymous pull available. The redundant diagnostic CI run was cancelled after direct-layer publication succeeded.
- All 34 weight/config files (60.17 GB), runtime and licenses are inside the image. No startup model downloads or model-cache mount. Former 100 GB `engui-maskflow-model-cache` was deleted and verified absent; common encrypted transport storage is unchanged.
- Final allocation: MaskFlow min0/max2, Krea2 max6. Model is available through MCP only; desktop/mobile unchanged.
- Four minimal baked-image GPU requests failed during migration. Diagnostics identified offline adapter filename inference and disabled PEFT-0.20 metadata fields unsupported by pinned PEFT-0.19.1. Those were corrected without changing active adapter settings or weights. A fourth request loaded the model/adapter successfully but revealed a missing Triton C compiler; build-essential was then baked in and real offline compilation/import verified locally. After correcting it, a fresh synthetic 512x512, **1-step** GPU smoke test completed; encrypted source, mask, prompt/settings and result roundtrip passed. Model initialization: 30.827s; engine processing/inference: 2.371s; whole handler: 34.847s. Warm model at request start: False.
- Provider queue/startup delay: 59.940s; provider execution: 34.884s. These provider totals are not model-download or pure-inference measurements.
- This short test verifies deployment/encryption, not edit quality or 50-step throughput. Production defaults remain 50 steps / CFG4. Public Showdown MCP passed 10 checks using plans only, without another generation. Synthetic transport objects were removed after local proof was retained.
