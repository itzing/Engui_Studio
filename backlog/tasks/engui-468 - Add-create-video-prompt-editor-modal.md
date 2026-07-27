# ENGUI-468 - Add Create Video prompt editor modal

## Status

Done

## Context

Create Image opens a larger prompt editing dialog from the main prompt textarea. Create Video still edits the prompt only inside the compact form textarea, which makes long WAN video prompts harder to review and edit.

## Scope

- Desktop Create Video prompt field.
- Match the Create Image large prompt editor behavior and controls.
- Keep mobile Create Video unchanged.

## Acceptance Criteria

- Focusing the desktop Create Video prompt opens a large prompt editor dialog.
- The dialog edits a draft until the user saves it.
- Ctrl+Enter or Cmd+Enter saves and closes the dialog.
- Cancel closes the dialog without applying the draft.
- Prompt template autocomplete remains available in the large editor.

## Rollback

Revert the implementation commit, run the production build, restart `engui-studio.service`, and verify Create Video.
