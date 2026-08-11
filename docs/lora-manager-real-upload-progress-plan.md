# LoRA Manager Real Upload Progress Plan

## Goal

Replace the simulated LoRA Manager upload progress with byte-based progress for large LoRA files on desktop and mobile.

## Approach

1. Add LoRA-specific multipart init/finalize API routes.
2. Reuse the existing S3 multipart proxy route for part uploads.
3. Update `LoRAManagementDialog` to upload file slices with `XMLHttpRequest.upload.onprogress`.
4. Create the LoRA database record only after multipart completion succeeds.
5. Abort incomplete multipart uploads on failure or cancellation.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
