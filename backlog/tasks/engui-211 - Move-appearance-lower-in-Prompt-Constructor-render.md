# ENGUI-211 - Move appearance lower in Prompt Constructor render

## Summary
Move character appearance lower in Prompt Constructor output for a more action-first feel.

## Scope
- update sceneTemplateV2 character render ordering so `appearance` comes after `props`
- preserve the rest of the character field order unless required by the new placement
- update regression coverage for the new order

## Acceptance Criteria
- when appearance and props exist, appearance renders after props
- the rest of the action-first ordering stays intact
- tests cover the new render order
