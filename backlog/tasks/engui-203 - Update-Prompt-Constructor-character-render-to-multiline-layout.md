# ENGUI-203 - Update Prompt Constructor character render to multiline layout

## Summary
Refine desktop Prompt Constructor character rendering so the first item after `Character N:` is the plain character name, pose is labeled explicitly, and each field renders on its own line for readability.

## Scope
- render the character name as plain text, without `name:`
- place the plain name first after `Character N:`
- render pose as `Pose: {value}`
- separate character render fields onto new lines instead of one comma-joined line

## Acceptance Criteria
- rendered character blocks are multi-line and easier to scan
- the first rendered character field is the plain name value when present
- pose renders as `Pose: {value}`
- render-format tests cover the updated layout
