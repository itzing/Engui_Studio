# Engui 345 Source Image Metadata Video Reuse Plan

## Goal

Preserve the metadata of an image used as a WAN22 img2vid source and use it later when a resulting video is sent back to txt2img.

## Approach

- Add a `sourceImageGenerationSnapshot` JSON envelope to img2vid reuse payloads produced from image job outputs and image gallery assets.
- Persist that envelope in the WAN22 video draft and append it to `/api/generate` submissions.
- Store the envelope in video job `options`; Gallery already copies job options into `generationSnapshot` when saving a job output.
- Let WAN22 video reuse advertise `txt2img`, and build the Create Image payload from `sourceImageGenerationSnapshot`.

## Validation

- Focused API and draft persistence tests for job reuse, gallery reuse, and WAN22 generation metadata persistence.
- Production build and service restart.
