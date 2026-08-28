# ENGUI-532 - Add copy prompt button to Character Manager

Labels: [characters, prompt, desktop, studio]

## Problem

Character Manager shows structured character traits, but there is no direct action to copy the fully assembled character prompt for the selected draft. Users currently have to reconstruct it manually from trait chips and sections.

## Acceptance Criteria

- [x] Character Manager exposes a `Copy prompt` action for the current character draft.
- [x] The copied text uses the same character prompt assembly format used by Scene and Prompt Constructor flows.
- [x] The action copies unsaved draft edits when the visible draft has been changed.
- [x] Users receive success and failure toast feedback.
- [x] Focused component coverage verifies clipboard output.

## Rollback

Revert the implementation commit, run the production build, and restart `engui-studio.service`.
