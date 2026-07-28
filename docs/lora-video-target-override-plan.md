# LoRA Video Target Override Plan

## Goal

Support valid WAN video LoRAs that do not have both high and low components while keeping the existing automatic classification for ordinary LoRA files.

## Current Behavior

- Complete high/low pairs are treated as video LoRAs.
- Standalone or incomplete high/low LoRAs are treated as image LoRAs.
- The WAN video picker only lists complete pairs.
- WAN submit serialization only sends a LoRA slot when both high and low values are present.

## Target Behavior

- Add a persisted manual target override on each LoRA record.
- Default classification remains automatic:
  - complete high/low pair files are video LoRAs;
  - all other files are image LoRAs.
- A user can mark any standalone or incomplete LoRA as video in LoRA Manager.
- The WAN video picker can show complete pairs and manually video-marked incomplete high/low entries.
- WAN submit serialization sends `lora_pairs` when either high or low exists, matching the DaSiWa endpoint contract.

## Validation

- Unit tests for image/video filtering and pair building.
- RunPod payload tests for high-only WAN22 LoRA payloads.
- Focused component tests for WAN video LoRA selector behavior.
- Prisma validate, production build, service restart, and HTTP smoke checks.
