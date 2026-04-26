# ENGUI-201 - Restore last opened Prompt Constructor draft on open

## Summary
Make Prompt Constructor automatically reopen the last opened saved draft for the active workspace.

## Problem
Right now Prompt Constructor opens into a fresh local draft every time, even when the user was actively working with an existing saved scene draft. That adds unnecessary clicks and breaks flow continuity.

## Scope
- remember the last opened saved prompt document per workspace
- restore that document automatically when Prompt Constructor opens
- keep existing reuse-draft hydration behavior working
- do not invent persistence for unsaved local drafts in this pass

## Acceptance Criteria
- opening a saved prompt document stores it as the last opened draft for that workspace
- reopening Prompt Constructor auto-loads that saved draft
- saving a local draft as a real prompt document makes it the new remembered draft
- if the remembered draft no longer exists, Prompt Constructor falls back safely
- tests cover automatic restore behavior
