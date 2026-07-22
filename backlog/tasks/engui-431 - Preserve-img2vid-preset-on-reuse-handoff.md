# ENGUI-431 - Preserve img2vid preset on reuse handoff

status: done
labels: [desktop, mobile, create, img2vid, presets, bug]

## Goal

Keep the currently selected Create img2vid preset visible when opening img2vid from Gallery or Jobs.

## Scope

- Shared `persistCreateReuseDraft` handoff logic used by desktop and mobile Gallery/Jobs reuse actions.
- Preserve `selectedPresetId` when `preserveVideoDraftFields` is enabled.
- Keep the existing source-image update behavior unchanged.

## Validation

- Focused reuse draft regression tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify reuse handoff returns to previous behavior.
