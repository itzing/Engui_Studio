# Krea2 Turbo i2i — desktop + MCP

ENGUI-612 extends the existing Krea2 Turbo worker and Engui adapter; it does not replace Krea2 with Z-Image or Qwen Edit.

## Desktop
Select Krea2 Turbo → I2I. Upload/paste/drop one source, set the desired positive prompt and Denoise under Advanced Settings. Default denoise is0.35; seed, dimensions, steps, CFG and eight LoRA slots remain available. Uploading a source preserves the current Krea2 prompt. Dimensions are rounded to the supported64-pixel grid and512..2048 range; the worker resizes without cropping. Match the source aspect ratio to avoid stretching. Text mode excludes the source and uses an empty latent. Primary source bytes persist in workspace-scoped browser draft storage for reload/model switch/reuse; source references are not shared between workspaces. Mobile UI is unchanged.

## MCP
Call engui_create_upload/PUT/engui_get_upload or choose an existing Gallery/Job output. Prepare modelId=krea2-turbo, mode=image_to_image, references=[source], parameters={steps:8,cfg:1,denoise:0.35}, explicit width/height, seed(s) and optional compatible LoRAs. Review the frozen plan before an authorized start. Text mode accepts no reference or denoise. Old plans are not rewritten. Reconnect clients to refresh MCP2.4 discovery/instructions.

## Worker
Repository: https://github.com/itzing/ZImage_runpod/tree/krea2

The i2i graph uses the existing baked Krea2 Turbo UNet, Qwen3VL encoder and Qwen Image VAE. LoadImage → ImageScale(bicubic,no crop) → VAEEncode replaces EmptySD3LatentImage, and KSampler receives denoise. Dynamic LoRA nodes feed the Krea2 sampler. Secure init-image role is init_image (legacy source_image accepted). Prompt/LoRA and media encryption plus encrypted output finalization are unchanged. No new disk, weights or runtime download. Denoise0 is a lossy VAE round trip, not pixel-perfect identity; this is not MaskFlow or instruction-based editing. Negative prompting has no guidance effect at CFG1.

## Rollout and rollback
Keep the previous app build and RunPod image reference. Validate the graph/LoRA topology, encrypted upload→plan→dispatch, desktop interactions and a small synthetic GPU job. Preserve quota/worker settings and durable in-flight provider IDs. Restore previous image and app build together if needed.
