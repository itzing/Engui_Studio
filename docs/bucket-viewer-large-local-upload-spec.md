# Bucket Viewer Large Local Upload Spec

## Goal

Add a desktop-only local file upload flow to Bucket Viewer that can handle very large model and LoRA files without proxying the file body through the Next.js server.

The immediate target is uploading Wan/DaSiWa LoRA or checkpoint-style files around 13-14 GB into the RunPod S3-compatible network volume, especially under `loras/`.

## Current Behavior

- `S3BucketViewerDialog` can list, browse, preview, and delete objects in the configured volume.
- `/api/s3-storage/upload` exists, but it reads the full multipart body with `request.formData()`, copies it into a Node `Buffer`, writes a temp file, and then calls `aws s3 cp`.
- That path is not suitable for multi-GB files because it puts the browser, Next.js process memory, local disk, and request timeout in the hot path.

## Desired Behavior

- Desktop Bucket Viewer exposes an `Upload` action for the current folder.
- The browser slices the selected local file into large parts.
- The backend creates an S3 multipart upload.
- If the RunPod endpoint allows browser CORS, the browser can send each part directly to the RunPod S3 endpoint.
- If the RunPod endpoint blocks browser CORS, the browser sends each part to a same-origin streaming proxy route and Engui relays the part stream to RunPod S3 without buffering the full file.
- The backend completes or aborts the multipart upload.
- Bucket Viewer refreshes the current folder when upload completes.

## Scope

Included:

- Desktop Bucket Viewer UI only.
- Local file upload from the user's browser.
- Single or multiple selected local files uploaded sequentially.
- Multipart upload to the selected volume/current folder.
- Same-origin streaming multipart-part proxy for S3-compatible endpoints that do not expose CORS headers.
- Progress display, speed, retry, and cancel.

Excluded:

- Mobile UI.
- Import from URL.
- Background upload persistence after closing the browser tab.
- Automatic LoRA database sync across workspaces.

## API Shape

Add routes under `/api/s3-storage/multipart`:

- `POST /init`
  - Input: `volume`, `path`, `fileName`, `contentType`, `fileSize`
  - Output: `uploadId`, `key`, `partSize`
- `POST /part`
  - Input: `volume`, `key`, `uploadId`, `partNumber`
  - Output: signed `url`
- `PUT /proxy-part`
  - Query: `volume`, `key`, `uploadId`, `partNumber`
  - Body: raw file part stream
  - Output: `partNumber`, optional `eTag`
- `POST /complete`
  - Input: `volume`, `key`, `uploadId`, optional uploaded `parts`
  - Output: final `key`, `filePath`, `s3Url`
- `POST /abort`
  - Input: `volume`, `key`, `uploadId`
  - Output: success

The preferred backend path only signs/controls multipart state. For RunPod endpoints that block browser CORS, the fallback backend path may receive one file part at a time as a stream, but must not call `arrayBuffer()` or buffer the full file.

## Notes

- Use path-style S3 addressing for RunPod-compatible endpoints.
- RunPod network volume S3 endpoints may not answer browser CORS preflight requests. In that case, the same-origin streaming proxy is required.
- Do not require reading the `ETag` response header in the browser; some S3-compatible CORS setups do not expose it. The complete route can list uploaded parts when ETags are missing.
- Use a conservative part size, initially 64 MiB, to keep a 14 GB upload far below the S3 10,000 part limit.
- If the selected path is `loras/`, the user should run the existing LoRA Manager "Sync from S3" action after upload so records are created with the correct workspace context.
