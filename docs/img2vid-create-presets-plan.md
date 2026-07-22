# img2vid Create Presets Plan

## Goal

Add compact presets to the shared Create video form so desktop and mobile `img2vid` users can save the current prompt and video settings, apply a saved preset later, and keep the selected preset in the existing video draft persistence.

## Scope

- Shared `VideoGenerationForm`, used by desktop and mobile Create video.
- Presets ask for a user-provided name, then save `prompt`, `showAdvanced`, and `parameterValues` for the current video model.
- The selected preset id is saved with the video workflow draft.
- Preset selector supports deletion with inline two-click confirmation.
- WAN video Prompt Helper controls become one compact row: helper icon, `Clear` checkbox, saved magic wand icon.
- Do not store source media in presets, so applying a preset does not replace the current `img2vid` reference image.

## Validation

- Focused unit tests for preset storage behavior.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify Create video returns to the previous prompt helper layout without presets.
