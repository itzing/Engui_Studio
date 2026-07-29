# LoRA Sync Missing S3 Record Prune Plan

## Goal

Make LoRA Manager's Sync from S3 action reflect S3 removals by deleting database records whose files no longer exist under the S3 `loras/` prefix.

## Current Behavior

- Sync lists `loras/` in S3.
- It imports missing `.safetensors` and `.ckpt` files into the `loras` table.
- Existing database records are skipped.
- Records for files deleted outside Engui remain visible until manually removed from the database.

## Target Behavior

- Build the canonical set of current S3 LoRA paths from listed `.safetensors` and `.ckpt` files.
- Import new records as before.
- Query LoRA records for the sync workspace.
- Delete records whose `s3Path` is absent from the current S3 set.
- Return synced, skipped, deleted, and total counts.

## Validation

- Focused API route tests for importing, skipping, and pruning stale records.
- `git diff --check`.
- Prisma validation.
- Production build and service restart.
