# ENGUI-453 - Exclude source image snapshot from video presets

labels: [desktop, mobile, create, img2vid, presets]
status: Done

## Goal

Do not save `sourceImageGenerationSnapshot` inside video create presets. That metadata belongs to the selected source image, not the reusable video preset.

## Acceptance Criteria

- Creating a new video preset strips `sourceImageGenerationSnapshot` from saved `parameterValues`.
- Overwriting an existing video preset strips `sourceImageGenerationSnapshot` from saved `parameterValues`.
- Applying a video preset preserves the current source image snapshot if the current draft has one.
- Server video preset API strips `sourceImageGenerationSnapshot` from incoming and returned preset payloads.
- Focused tests cover the sanitizer and API persistence behavior.

## Implementation Notes

- Added client preset sanitization for create/update/normalization.
- Applying a preset keeps the currently selected source image snapshot if present.
- Added server-side preset normalization guard.
