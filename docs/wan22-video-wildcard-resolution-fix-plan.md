# Wan 2.2 Video Wildcard Resolution Fix Plan

## Problem

`Resolved video` can still display unresolved `{...}` after the resolved prompt metadata fixes. The likely gap is variant parsing after workspace wildcard expansion: prompt wildcard values can be formatted as multiline `{option A|option B}` groups, while the current resolver only handles single-line brace groups.

## Plan

1. Make prompt variant parsing handle multiline brace groups without changing literal brace behavior.
2. Add regression coverage for multiline variants and Wan 2.2 video `resolvedVideoPrompt` metadata.
3. Run focused tests, lint, Prisma validation, production build, restart the service, smoke test key routes, commit, and push.

## Rollback

Revert the new Engui commit, rebuild, and restart `engui-studio.service`.
