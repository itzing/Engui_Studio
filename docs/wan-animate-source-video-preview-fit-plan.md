# Wan Animate Source Video Preview Fit Plan

## Scope

Surface: desktop Create and mobile Create. The issue is limited to the source video preview in the shared `VideoGenerationForm`.

## Findings

- The browser preview uses the original object URL or Gallery/job URL, but renders it with `object-cover` in a fixed-height box.
- `object-cover` crops tall source videos visually, so a 720x1280 upload appears as the centered middle slice.
- Form submission appends the original `File` under the `video` field.
- The secure RunPod path uploads the full source video bytes as `media_inputs` role `source_video`; Engui does not crop or resize the uploaded file before sending it.
- The Wan Animate endpoint passes the decrypted source video filename to the ComfyUI `VHS_LoadVideo` node. That workflow then resamples frames to the requested output width/height.

## Implementation

- Change the source video preview renderer from cover fit to contain fit.
- Keep the existing fixed preview height and controls.
- Add a dark backing surface so letterboxed portrait/landscape previews are visually clear.
- Add focused component coverage that verifies uploaded video previews use contain fit.
