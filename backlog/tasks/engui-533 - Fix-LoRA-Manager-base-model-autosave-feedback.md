# ENGUI-533 - Fix LoRA Manager base model autosave feedback

Labels: [lora, create-image, create-video, desktop, mobile]

## Problem

LoRA Manager has a `Base model` dropdown, but changing it provides no visible feedback and some high/low LoRA pairs can still be displayed through automatic WAN pair detection instead of the saved base model. This makes the change look like it was not saved.

## Acceptance Criteria

- [x] Changing a LoRA `Base model` continues to save immediately on dropdown change.
- [x] The saved `baseModel` value takes priority over automatic high/low WAN pair detection.
- [x] Users receive visible success feedback when a LoRA model update is saved.
- [x] Focused coverage verifies the dropdown PATCH request and the saved selection after reload.
- [x] API coverage verifies `PATCH /api/lora/:id` accepts a `baseModel`-only payload.

## Implementation Notes

The LoRA Manager dropdown still saves through `PATCH /api/lora/:id` on change. The shared model filter helper now treats explicit `baseModel` metadata as authoritative before legacy high/low WAN pair detection, and the manager shows `LoRA model updated.` after a successful update. The LoRA metadata PATCH route now validates `targetOverride` only when it is present, so `baseModel`-only autosave requests are accepted.

## Rollback

Revert the implementation commit, run the production build, and restart `engui-studio.service`.
