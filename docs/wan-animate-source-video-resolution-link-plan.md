# Wan Animate Source Video Resolution Link Plan

## Context

Wan Animate uses the uploaded source video as the motion/source clip, then the workflow resamples frames to the requested `width` and `height`. After the source preview fix, the next UX issue is that the user still has to manually set portrait output dimensions.

## Plan

1. Read source video metadata from the preview video element.
2. For Wan Animate only, set `width` and `height` to the detected source dimensions.
3. Keep later width/height edits linked to the detected aspect ratio.
4. Add compact up/down scale controls that change both dimensions together.
5. Cover the behavior with focused `VideoGenerationForm` tests.

## Validation

- Focused component tests for Wan Animate resolution linking.
- Targeted ESLint for touched files.
- `git diff --check`.
- `npx prisma validate`.
- Production build.
- Service restart and HTTP smoke checks.
