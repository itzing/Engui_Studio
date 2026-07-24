# engui-452 - Add prompt template autocomplete and variant picker

## Status

Done

## Summary

Add prompt template autocomplete and fixed variant selection for manual image prompts on desktop Create and mobile `/m/create`.

## Acceptance Criteria

- [x] Typing `{` in supported prompt textareas opens a template autocomplete.
- [x] Typing after `{` filters existing templates by key, name, and value.
- [x] Selecting a template inserts `{templateKey}`.
- [x] Existing `{templateKey}` prompt tokens can be selected through the UI and assigned a specific variant.
- [x] Fixed variants are serialized in the prompt and resolve consistently on submit.
- [x] Existing `{templateKey}` random/default behavior remains unchanged.
- [x] Desktop Create and mobile `/m/create` are both covered.
- [x] No real generation jobs are launched during validation.

## Implementation Notes

- Prompt templates are backed by `PromptWildcard`.
- Fixed variant syntax is `{templateKey:variant text}`.
- User-facing UI text must be English.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
