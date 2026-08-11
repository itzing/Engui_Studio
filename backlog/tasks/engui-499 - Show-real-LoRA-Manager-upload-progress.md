---
id: ENGUI-499
title: Show real LoRA Manager upload progress
status: Done
assignee: []
created_date: '2026-08-11'
labels: [desktop, mobile, lora, storage, upload]
---

## Description

LoRA Manager currently shows simulated upload progress that quickly reaches 90% and then waits there until the server finishes uploading the file to S3. Replace this with byte-based progress from a multipart upload path.

## Acceptance Criteria

- LoRA Manager uploads files through multipart S3 upload into `loras/`.
- The progress bar reflects real uploaded bytes rather than a timer.
- Completing the multipart upload creates the LoRA database record with the selected workspace.
- Upload failure aborts the multipart upload when possible.
- The UI shows current file status during uploading/completing/failed states.
- Desktop and mobile surfaces that use LoRA Manager get the same behavior.
- Focused tests and production build pass.

## Notes

- Reuse the existing Bucket Viewer multipart infrastructure where possible.
- Keep the legacy `/api/lora/upload` route unchanged as a fallback.
- Implemented with LoRA-specific multipart init/finalize routes, shared S3 multipart proxy part upload, byte-based XHR progress, cancel, and part retry.
