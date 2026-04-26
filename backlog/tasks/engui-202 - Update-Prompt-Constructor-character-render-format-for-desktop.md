# ENGUI-202 - Update Prompt Constructor character render format for desktop

## Summary
Adjust desktop Prompt Constructor character rendering and field labels so scene character output matches the user's preferred format.

## Scope
- render age as `22yo`
- render expression as `{value} face expression`
- place expression immediately after gender and before appearance
- use `boy` / `girl` when age is under 18
- use `male` / `female` for 18+
- render name as `name: {value}`
- remove character `label` from the editable character UI and from rendered output
- rename `Name or role` field to `Name`
- render name before role
- render role as `Role: {value}`

## Acceptance Criteria
- desktop Prompt Constructor character UI no longer exposes `label`
- character name input is labeled `Name`
- rendered character blocks follow the requested field order and wording
- targeted tests cover the new render formatting
