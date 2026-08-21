# engui-524 - Add search filter sort to LoRA Manager

Labels: [lora, manager, ui, search]

## Summary

Add client-side LoRA Manager controls for searching LoRAs, filtering by Image or Video target, and sorting by name.

## Scope

- LoRA Management dialog list controls.
- Client-side list grouping and empty states.
- Focused component regression coverage.

## Acceptance Criteria

- [x] Users can search LoRAs by display name, file name, or path.
- [x] Users can filter the manager list to All, Image, or Video LoRAs.
- [x] Users can sort visible groups by name ascending or descending.
- [x] Filtering and sorting work in both desktop and mobile dialog layouts.

## Result

- Added a responsive LoRA Manager toolbar with search, All/Image/Video target filters, and Name A-Z/Z-A sorting.
- Reused the existing LoRA target classification helpers so manager filtering matches create-form model targeting.
- Added focused component coverage for search, target filtering, and name sorting.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify LoRA Manager returns to the previous unfiltered list.
