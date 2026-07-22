# ENGUI-428 - Preserve selected img2vid preset

status: done
labels: [desktop, mobile, create, img2vid, presets, bug]

## Goal

Fix Create video/img2vid so the selected preset remains selected after reload/remount. The current prompt and settings were persisted, but the preset label could fall back to `-`.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Keep draft autosave from writing before video draft hydration finishes.
- Do not clear a restored `selectedPresetId` until presets have loaded from local storage.
- Keep existing preset creation, naming, apply, delete, and selected draft persistence behavior.

## Validation

- Focused preset storage/selection tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the form returns to ENGUI-427 behavior.

