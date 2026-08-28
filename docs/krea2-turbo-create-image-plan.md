# Krea2 Turbo Create Image Plan

## Scope

Add Krea2 Turbo as a first-class Create Image model on desktop and mobile. The user experience should match the current Z-Image text generation flow: manual width and height, seed with randomization, eight optional LoRA slots with weights, secure RunPod transport, and reuse back into the same model.

## LoRA Base Models

LoRA records gain `baseModel`:

- `wan2.2`
- `z-image`
- `krea2-turbo`

Existing image records default to `z-image`. Existing records already marked as video are backfilled to `wan2.2`. New uploads write both base model and image/video target so selectors and manager filters stay aligned.

## Endpoint

Create a new endpoint branch named `krea2`, based on the current `zimage` branch if useful. Do not use `zimage-mpm`.

The Docker image should include:

- Krea2 Turbo diffusion model under ComfyUI diffusion models.
- Qwen3-VL text encoder under ComfyUI text encoders.
- Qwen image VAE under ComfyUI VAE models.
- The same secure payload and secure result transport contract used by Z-Image.
- A Krea2 text workflow with a dynamic model-only LoRA chain.

## Validation

- Prisma generate and schema push.
- Focused tests for model filtering and reuse payloads when present.
- Typecheck or lint for touched frontend/API files.
- Production build, service restart, and HTTP smoke check.
