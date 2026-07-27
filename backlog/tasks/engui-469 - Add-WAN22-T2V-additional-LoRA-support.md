# ENGUI-469 - Add WAN22 T2V additional LoRA support

## Status

Done

## Problem

`wan22-t2v` uses a baked LightX2V Lightning high/low LoRA pair in the endpoint workflow, but Engui does not expose any additional high/low LoRA picker or send `lora_pairs` for T2V jobs.

## Scope

- Desktop Create Video.
- Mobile Create Video, through the shared video generation form.
- RunPod payload building for `wan22-t2v`.
- Existing WAN22 I2V LoRA behavior.

## Acceptance Criteria

- [x] `wan22-t2v` model config exposes four high/low LoRA pair slots.
- [x] Create Video shows the existing WAN22 LoRA pair picker for T2V.
- [x] T2V LoRA weights use the shared freeform `-10..10` validation.
- [x] `wan22-t2v` RunPod payload includes `lora_pairs` when complete high/low pairs are selected.
- [x] Existing WAN22 I2V behavior remains unchanged.

## Rollback

Revert the Engui implementation commit, run `npm run build`, restart `engui-studio.service`, and verify Create Video routes still load.
