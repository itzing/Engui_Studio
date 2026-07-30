# Prompt Wildcard Subset and Sequential Resolution Plan

## Goal

Allow prompt wildcard tokens to target a selected subset of wildcard variants and optionally rotate through that subset sequentially across generation submissions.

## Design

- Keep prompt text compact:
  - `{eyesColor}` means random from all variants.
  - `{eyesColor:0,2,5}` means only absolute variant indices `0`, `2`, and `5` are eligible.
- Store behavior outside the prompt in create metadata:
  - `mode`: `random` or `sequential`.
  - `startIndex`: index inside the selected subset.
  - `cursor`: current index inside the selected subset.
- Resolve random subsets by expanding `{key:0,2,5}` into a brace group containing only the selected values, then use existing seeded prompt variant resolution.
- Resolve sequential subsets server-side, return updated cursor metadata, and let create draft persistence store the next cursor.

## Scope

1. Add shared wildcard selection types and normalization helpers.
2. Update `PromptTemplateTextarea` picker UI for multi-select, mode, start index, and subset serialization.
3. Update `/api/generate` prompt wildcard expansion to understand numeric subset tokens and sequential selection metadata.
4. Persist metadata in image create drafts, video create drafts, video presets, optimistic jobs, and generation options.
5. Add focused regression tests.

## Notes

Sequential cursor is scoped to the active draft or preset, not globally to the workspace wildcard. That prevents unrelated prompts from moving each other's sequence.
