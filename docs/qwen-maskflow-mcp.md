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

Prompt, authenticated generation settings, source, mask and output use Engui AES-256-GCM v1 with job/model/attempt/direction/role bindings. There is no plaintext fallback. Secrets are outside Git. Public model weights and runtime are cached separately; each worker runs one generation at a time.

Deployment uses a published CUDA/PyTorch image digest and pinned bootstrap, not a custom Docker build. The endpoint has 0 minimum and 2 maximum workers on 96 GB GPUs. A 100 GB persistent cache holds public weights/runtime; this storage is billed separately even when GPU workers are idle.

## Verified deployment (2026-11-24)

- Endpoint `dnc6cjeffpqwfy`; handler revision `501930b4c36f7e1c641c420ab76cb8f3878adfaf`.
- Krea2 maximum workers reduced from 8 to 6; other endpoint limits unchanged.
- One real synthetic secure inference completed on the preceding handler revision `c6d5815`; the later change only strengthens transparent-mask validation. Runtime, model and engine are unchanged.
- 512x512 output decrypted successfully; inference execution about 95 seconds after queue time. Far background more than 25 pixels outside the mask was pixel-identical. The model added an unwanted white shape inside the edit region, so this is an operational validation, not a quality guarantee.
- 19 endpoint CPU tests; 191 application tests; 22 candidate HTTP checks and 10 public Showdown MCP checks. Public MCP validation created plans only, without another paid generation.
