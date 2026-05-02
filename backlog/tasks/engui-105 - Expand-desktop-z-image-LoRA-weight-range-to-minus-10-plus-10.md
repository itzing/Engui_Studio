# engui-105 - Expand desktop z-image LoRA weight range to -10..10

## Summary
Allow setting Z-Image LoRA weights on desktop in the range `-10` to `10`.

## Scope
- Desktop create form for `z-image`
- Numeric input and slider/clamping behavior, if present
- Keep mobile unchanged unless shared config requires it

## Acceptance Criteria
- On desktop, Z-Image LoRA weight accepts values from `-10` to `10`
- UI does not clamp the value back to a narrower range
- Build passes

## Status
- Implemented in desktop `ImageGenerationForm`
- Updated Z-Image LoRA weight parameter ranges in shared model config to `-10..10`
- Build passed
