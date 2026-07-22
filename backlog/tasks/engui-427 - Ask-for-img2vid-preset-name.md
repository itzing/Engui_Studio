# ENGUI-427 - Ask for img2vid preset name

status: done
labels: [desktop, mobile, create, img2vid, presets]

## Goal

When creating a Create video/img2vid preset, ask the user for a preset name instead of silently generating an automatic `Preset N` name.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- The `+` preset action opens a compact name dialog.
- Saving requires a non-empty name and stores the current prompt/settings snapshot under that name.
- Applying, selecting, deleting, and selected preset draft persistence remain unchanged.

## Validation

- Focused preset storage tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify preset creation returns to automatic naming.

