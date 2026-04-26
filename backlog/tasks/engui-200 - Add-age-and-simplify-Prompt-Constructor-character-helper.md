# ENGUI-200 - Add age and simplify Prompt Constructor character helper

## Summary
Add a dedicated `age` field to Prompt Constructor character slots, then simplify the character helper flow so only the `appearance` field shows Character Manager suggestions.

## Problem
The current Prompt Constructor character UX is close, but still misses a few basics:
- character slots have gender but no age field
- the helper panel currently uses generic library logic instead of the desired direct Character Manager selection flow for appearance
- selecting a character should fill the scene character slot in a predictable way

## Scope
- add `age` input to character slots in Prompt Constructor
- when the active field is `appearance`, show Character Manager entries with a `Select` button for each
- do not show extra Character Manager helper logic for other character fields yet
- on `Select`, fill:
  - `nameOrRole` with the Character Manager name
  - `appearance` with the full Character Manager render excluding the name

## Acceptance Criteria
- character slot UI visibly includes an `Age` field
- focusing `appearance` in a scene character slot shows Character Manager entries in the helper panel
- helper selection writes the chosen character name into `nameOrRole`
- helper selection writes the rendered character appearance into `appearance` without prepending the character name
- existing save/load behavior remains compatible
- tests cover the new helper selection behavior

## Notes
Keep this intentionally narrow. No extra library composition logic for other character fields in this pass.
