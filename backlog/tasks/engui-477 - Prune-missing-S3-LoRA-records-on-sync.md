# ENGUI-477 - Prune missing S3 LoRA records on sync

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

LoRA Manager's Sync from S3 action imports missing database records for files found under `loras/`, but it leaves database records behind when files have already been removed directly from S3 or the RunPod volume.

## Scope

- Surface: shared LoRA Manager backend sync API.
- After listing S3 `loras/`, remove LoRA database records in the current workspace when their `s3Path` no longer maps to a listed `.safetensors` or `.ckpt` file.
- Keep S3 files untouched.
- Keep existing import behavior for new S3 files.
- Return deleted records in the sync response for diagnostics.

## Rollback

Revert the Engui commit, run `npm run build`, then restart `engui-studio.service`.

## Result

Implemented in LoRA sync API. Sync now imports missing S3 LoRAs as before, then prunes current-workspace database records whose `s3Path` is absent from the current S3 `loras/` file list. The response includes `deleted` entries for diagnostics, and LoRA Manager shows a dedicated success message when stale records were removed.
