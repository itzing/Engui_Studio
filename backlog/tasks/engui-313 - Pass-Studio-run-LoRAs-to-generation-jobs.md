# ENGUI-313 - Pass Studio run LoRAs to generation jobs

Status: done

## Request
LoRAs selected in Studio run settings are not visible in Job Details and appear not to be used by run jobs.

## Root cause
Studio run launch reads generation settings from the immutable `templateSnapshotJson`, while the LoRA selector saves current values into `runSettingsJson`. Launch therefore uses stale settings and never appends selected `lora` / `lora2`... fields to `/api/generate`.

## Scope
- Merge current `runSettingsJson` over snapshot generation settings at launch time.
- Preserve existing template snapshot fallback.
- Ensure future jobs persist LoRA options so `LoRAs used` appears in Job Details.

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
