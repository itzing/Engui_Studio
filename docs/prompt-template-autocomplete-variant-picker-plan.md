# Prompt Template Autocomplete and Variant Picker Plan

## Scope

- Add prompt template autocomplete for manual image prompts on desktop Create and mobile `/m/create`.
- Keep user-facing UI text in English.
- Do not launch real generation jobs as part of validation.

## Current Behavior

- Prompt templates are stored as `PromptWildcard` records.
- `{templateKey}` is expanded on submit by `expandPromptWildcards`.
- Wildcard values can contain prompt variant groups such as `{blue eyes|green eyes}`.
- `resolvePromptVariants` picks one option deterministically from variant groups using the generation seed.

## Implementation

- Add a reusable prompt textarea wrapper that:
  - loads active prompt wildcards for the current workspace;
  - opens autocomplete when the cursor is inside an unfinished `{...` token;
  - filters templates by key, name, and value as the user types;
  - inserts `{templateKey}` on click, Enter, or Tab;
  - shows detected template tokens as clickable chips below the textarea;
  - opens a variant picker for tokens whose wildcard value has variants.
- Represent a fixed variant in the prompt as `{templateKey:variant text}`.
- Extend server wildcard expansion so fixed variant tokens resolve to the selected variant before normal `{templateKey}` expansion.
- Keep existing `{templateKey}` behavior unchanged, including seeded random/default variant resolution.

## Validation

- Unit test variant parsing.
- Component test autocomplete insertion and fixed variant selection.
- Server/API-safe checks: TypeScript/ESLint on touched files, Prisma validate, production build.
- Restart `engui-studio.service` after build and smoke core routes.

## Rollback

- Revert the implementation commit.
- Run `npm run build`.
- Restart `engui-studio.service`.
