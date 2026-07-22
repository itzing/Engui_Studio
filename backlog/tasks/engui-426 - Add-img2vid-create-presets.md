# ENGUI-426 - Add img2vid create presets

status: done
labels: [desktop, mobile, create, img2vid, presets]

## Goal

Add reusable presets to Create video/img2vid so users can save the current prompt and settings, then apply them later on desktop and mobile.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Save current prompt, advanced visibility, and parameter values as a preset for the current video model.
- Persist selected preset id with the video workflow draft.
- Preset selector supports inline confirm deletion.
- Compact WAN video Prompt Helper controls into one row with icon-only helper button, centered `Clear` checkbox, and icon-only magic wand action.

## Validation

- Focused preset storage tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Create video returns to the previous prompt helper controls.

## Result

Implemented. The shared desktop/mobile video Create form now has a compact `Presets` row for WAN img2vid: plus saves the current prompt, advanced state, and parameter values; the center shows the selected preset name or `-`; the selector opens a preset picker with inline two-click delete confirmation. Applying a preset restores settings without replacing the current source media. The selected preset id is persisted in the existing video draft. The WAN Prompt Helper controls now use one compact row: helper icon, centered `Clear` checkbox, and saved magic wand icon.
