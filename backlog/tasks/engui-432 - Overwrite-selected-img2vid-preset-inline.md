# ENGUI-432 - Overwrite selected img2vid preset inline

status: done
labels: [desktop, mobile, create, img2vid, presets]

## Goal

Add a save action for Create img2vid presets that overwrites the currently selected preset with the current prompt and settings.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Add a save icon to the left of the existing `+` preset creation action.
- Disable overwrite save when no preset is selected.
- Require inline confirmation before overwriting the selected preset.
- Preserve the selected preset name and id while updating prompt, advanced state, parameter values, and `updatedAt`.

## Validation

- Focused preset helper tests.
- Focused API preset route tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Result

Added a left-side overwrite save action to the WAN img2vid preset row. The action is disabled until a preset is selected, switches to a check icon for inline confirmation on first click, then overwrites the selected preset snapshot on second click while preserving its id and name.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the preset row returns to create/select only.
