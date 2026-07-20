# Prompt Wildcards Manager Plan

## Goal

Long brace variant groups are useful for generation but make prompts hard to read and edit. Authors should be able to keep short placeholders such as `{hairColor}` or `{bodyBuildType}` in prompts while Engui expands them only when submitting a render.

## Implementation

1. Add a workspace-scoped `PromptWildcard` table with `key`, `name`, `value`, and `status`.
2. Seed default wildcards when a workspace opens the manager and has none:
   - Eye color
   - Body type
   - Hair color
   - Haircut
3. Add desktop `Tools > Wildcards` in the Workspace header, immediately before `Sequences`.
4. Provide a two-pane modal:
   - left list with `New` first and existing wildcards below;
   - right editor for display name, key, and raw wildcard text.
5. In generation submit, keep `Job.prompt` as the authored prompt. Before RunPod secure payload creation:
   - expand `{key}` placeholders from the workspace dictionary;
   - then run the existing seeded `{a|b|c}` resolver;
   - persist `expandedPromptTemplate`, `resolvedPrompt`, seed, and replacement metadata in job options.

## Notes

Unknown placeholders remain unchanged. This keeps normal literal braces and future placeholders non-destructive.
