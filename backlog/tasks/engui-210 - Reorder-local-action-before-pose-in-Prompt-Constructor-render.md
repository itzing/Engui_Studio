# ENGUI-210 - Reorder local action before pose in Prompt Constructor render

## Summary
Render `Local action` before `Pose` in Prompt Constructor character output.

## Scope
- update sceneTemplateV2 character line ordering so `Local action` appears before `Pose`
- keep all existing labels and multiline formatting intact otherwise
- update regression coverage for the new order

## Acceptance Criteria
- when both values exist, rendered prompt shows `Local action: {value}` before `Pose: {value}`
- no other character field ordering changes unexpectedly
