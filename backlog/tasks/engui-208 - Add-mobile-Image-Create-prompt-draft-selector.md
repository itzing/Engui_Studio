# ENGUI-208 - Add mobile Image Create prompt draft selector

## Summary
Add a mobile Prompt Constructor draft selector to Image Create and hide manual prompt controls while a draft is selected.

## Scope
- add a wide tile in the mobile Image Create summary panel for Prompt Constructor draft selection
- show `Not selected` when no draft is linked
- open a mobile picker dialog with all saved Prompt Constructor drafts, matching the LoRA picker style
- after selection, show the draft title in the tile
- hide the manual prompt panel and prompt-related buttons on mobile while a draft is selected
- keep per-generate prompt re-rendering and scene linkage behavior aligned with desktop Image Create

## Acceptance Criteria
- mobile Image Create shows a prompt draft tile in the top panel
- tapping the tile opens a saved draft picker dialog
- selecting a draft shows its title and hides manual prompt controls on mobile
- clearing the selection returns manual prompt controls
- generating from mobile with a selected draft re-renders the latest draft prompt before submit
- tests cover the selected-draft mobile UI state and per-generate draft sync behavior
