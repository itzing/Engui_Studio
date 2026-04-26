# ENGUI-206 - Add random character appearance toggle to Prompt Constructor desktop

## Summary
Add a desktop-only random character option in Prompt Constructor appearance handling.

## Scope
- add a `Random` checkbox in the character appearance area
- when enabled, disable manual `Name` and `Appearance` inputs for that character slot
- during render, pick a random Character Manager entry that matches the slot gender
- use the selected random character's name and appearance in rendered prompt output

## Acceptance Criteria
- desktop Prompt Constructor shows a `Random` toggle for character appearance
- enabling it disables manual `Name` and `Appearance` fields for that slot
- rendered prompt uses a random Character Manager character with matching gender
- if no matching character exists, render remains stable and does not crash
- tests cover the new random render behavior and desktop UI disabling
