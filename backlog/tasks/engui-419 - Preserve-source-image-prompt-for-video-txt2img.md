# ENGUI-419 - Preserve source image prompt for video txt2img

status: done
labels: [create, gallery, jobs, mobile, desktop, prompt, reuse]

## Goal

When a WAN22 video is sent to `txt2img`, restore the prompt and generation options of the original image that produced the video, not the video prompt.

## Scope

- Desktop Job Details and Gallery Details.
- Mobile Job Details and Gallery Details.
- Job reuse API.
- Gallery reuse API.
- Keep image `txt2img` prompt tab overrides working for Original/Resolved prompts.
- For WAN22 video `txt2img`, ignore `promptOverride` and use `sourceImageGenerationSnapshot.prompt`.
- Preserve `img2img` and `img2vid` reuse behavior.

## Validation

- Focused API tests for job and gallery video `txt2img` with an accidental video prompt override.
- Focused/targeted lint for touched files.
- Production build, service restart, and route/API smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify video `txt2img` returns to the previous behavior.

## Result

Implemented for desktop and mobile Job/Gallery details. Image `txt2img` still sends the selected Original/Resolved prompt override, while WAN22 video `txt2img` no longer sends a client override and the API ignores one if it is accidentally supplied. Job and gallery reuse tests cover the override-hardening case.
