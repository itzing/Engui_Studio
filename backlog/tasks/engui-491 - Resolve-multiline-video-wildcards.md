# engui-491 - Resolve multiline video wildcards

## Status

Done

## Context

Wan 2.2 video jobs persist `videoPrompt` and `resolvedVideoPrompt`, but `Resolved video` can still show unresolved `{...}` groups when wildcard values expand to multiline variant groups. Video wildcard resolution must match image prompt behavior and resolve workspace wildcards plus brace variants before sending the prompt to the endpoint or persisting resolved metadata.

## Acceptance Criteria

- [x] Video prompt workspace wildcards are expanded before brace variant resolution.
- [x] Multiline brace variant groups resolve deterministically by seed.
- [x] `resolvedVideoPrompt` persists the endpoint-ready prompt for active jobs.
- [x] Regression tests cover video wildcard metadata.
- [x] Production build and service restart complete.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
