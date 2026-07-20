# ENGUI-403 - Add prompt wildcard manager

## Status

Done

## Scope

- Add desktop `Tools > Wildcards` access next to `Sequences`.
- Store workspace-scoped prompt wildcards as `{key}` dictionaries.
- Keep authored prompts unchanged in database and UI.
- Expand `{key}` wildcards server-side before seeded brace variant resolution and endpoint submission.
- Do not launch live RunPod jobs during validation.

## Rollback

Revert the implementation commit, run Prisma sync/build, and restart `engui-studio.service`.
