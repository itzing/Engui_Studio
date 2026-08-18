# ENGUI-505 - Restore WAN22 T2V base LightX2V settings

## Status

In progress

## Context

WAN22 T2V is moving from SmoothMix back to clean Wan 2.2 base with baked LightX2V 4-step LoRA. The Create Video UI should stop exposing SmoothMix-specific controls.

## Scope

- Shared desktop/mobile Create Video.
- Remove T2V Sigma shift from user-facing model parameters.
- Remove T2V FPS selection from user-facing model parameters and RunPod payload.
- Set T2V steps default to 4.
- Expose the existing Random seed toggle for T2V as well as I2V.
- Keep all user-facing UI text in English.

## Validation

- Focused Vitest coverage for T2V model config and Create Video random seed behavior.
- RunPod payload test confirms T2V no longer sends FPS or sigma shift.
- Production build and service restart after commit.
