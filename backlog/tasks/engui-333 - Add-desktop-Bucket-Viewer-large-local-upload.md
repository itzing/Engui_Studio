---
id: ENGUI-333
title: Add desktop Bucket Viewer large local upload
status: Done
assignee: []
created_date: '2026-07-03'
labels: [desktop, storage, s3, lora]
---

## Description

Add a desktop-only local file upload action to Bucket Viewer that supports very large files, such as 13-14 GB Wan/DaSiWa LoRA/checkpoint files, without proxying file bytes through Next.js.

## Acceptance Criteria

- Bucket Viewer has an Upload action for the current folder on desktop.
- Upload uses S3 multipart. When RunPod S3 blocks browser CORS, file parts go through a same-origin Engui streaming proxy to the configured RunPod S3-compatible volume.
- Next.js API routes create, sign, complete, abort, and can stream individual parts without buffering the full file.
- The RunPod proxy path may buffer one 64 MiB part at a time server-side so AWS SDK retries remain safe, but it must never buffer the full selected file.
- UI shows current file, destination key, progress, speed, and cancel state.
- Multiple selected files upload sequentially.
- Folder refreshes after successful upload.
- Existing list/delete/preview behavior remains unchanged.
- Production build passes.

## Notes

- Detailed spec: `docs/bucket-viewer-large-local-upload-spec.md`.
- Keep mobile out of scope for this ticket.
- If uploading into `loras/`, use existing LoRA Manager sync afterwards to attach uploaded files to the correct workspace.
- Browser direct upload failed against RunPod with missing `Access-Control-Allow-Origin` on preflight from `https://massive.taild3a871.ts.net`, so the active implementation uses the same-origin streaming part proxy.
- Follow-up runtime fix: AWS SDK streaming `UploadPart` failed with non-retryable streaming request errors on large parts. The proxy now reads only the current part into a retryable buffer and uploads parts sequentially from the browser.
