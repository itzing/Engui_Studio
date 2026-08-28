# ENGUI-531 - Add Krea2 Turbo image create and LoRA base models

Labels: [create, image, lora, desktop, mobile, runpod]

## Problem

Krea2 Turbo needs to be available in Create Image with the same core workflow as Z-Image: random seed, multiple LoRAs, secure RunPod transport, and gallery/job reuse. The existing LoRA catalog only separates Image and Video, which is not enough once image LoRAs must be separated between Z-Image Turbo and Krea2 Turbo.

## Acceptance Criteria

- [x] Create Image has a `krea2-turbo` model on desktop and mobile.
- [x] Krea2 Turbo supports up to eight LoRA slots with weights and random seed.
- [x] Krea2 Turbo submits through the secure RunPod envelope/result transport path.
- [x] LoRA records store a base model: `wan2.2`, `z-image`, or `krea2-turbo`.
- [x] LoRA Manager lets uploads and existing records choose the base model.
- [x] Desktop and mobile LoRA pickers show only LoRAs compatible with the active model.
- [x] Gallery/Jobs `To txt2img` reuse restores the original image model, including Krea2 Turbo.

## Notes

Backfill rule: existing image LoRAs default to `z-image`; existing records already marked as video are backfilled to `wan2.2`; new uploads write both base model and image/video target.

Endpoint work belongs on a new `krea2` branch in the endpoint repository. Ignore the old `zimage-mpm` branch.

## Rollback

Revert the implementation commit, run the production build, restart `engui-studio.service`, and keep the RunPod endpoint mapping pointed at the existing image endpoints.
