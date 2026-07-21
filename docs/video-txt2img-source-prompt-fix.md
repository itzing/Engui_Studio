# Video txt2img source prompt fix

## Problem

WAN22 videos keep `sourceImageGenerationSnapshot` so `txt2img` reuse can reproduce the original image. The UI currently sends the selected video prompt as `promptOverride` for every `txt2img` action. That override wins over the source image snapshot and puts the video prompt into Create Image.

## Plan

1. Keep selected prompt overrides only for image `txt2img` actions in desktop and mobile details surfaces.
2. Make job and gallery reuse APIs ignore `promptOverride` when the source being converted to `txt2img` is a video.
3. Add focused API tests that send a video prompt override and assert the returned Create Image payload still uses `sourceImageGenerationSnapshot.prompt`.

## Expected behavior

- Image `txt2img`: the selected Original/Resolved prompt tab is used.
- WAN22 video `txt2img`: the original source image prompt is used.
- `img2img` and `img2vid`: unchanged.
