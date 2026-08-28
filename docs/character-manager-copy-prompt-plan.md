# Character Manager Copy Prompt Plan

## Scope

Add a direct `Copy prompt` action to the shared Character Manager panel. The panel is currently reused by the desktop left panel and Studio workspace, so the change applies wherever that shared manager is opened.

## Behavior

- Render `Copy prompt` in the top action row near `Clone`, `Cancel`, and `Save`.
- Build the text from the current in-memory draft so unsaved edits are copied exactly as the user sees them.
- Reuse the existing `buildCharacterPromptFromSummary` formatter to stay aligned with Scene and Prompt Constructor character prompt assembly.
- Copy through `navigator.clipboard.writeText`.
- Show `Prompt copied` on success and `Failed to copy prompt` on clipboard failure.

## Validation

- Add a focused Character Manager component test for clipboard output.
- Run the focused Vitest file.
- Run production build, restart `engui-studio.service`, and smoke-check the deployed app.
