# engui-529 - Isolate sequential wildcard occurrence cursors

## Status

Done

## Context

When a prompt contains the same indexed wildcard placeholder more than once, for example `{hairColor:0,1} ... {hairColor:0,1}`, sequential mode currently uses a single cursor keyed only by `hairColor`. The first occurrence advances the cursor before the second occurrence resolves, so both placeholders share one counter inside the same prompt.

## Acceptance Criteria

- [x] Sequential indexed wildcard placeholders with the same key and same selection in one prompt resolve from independent cursors.
- [x] Returned prompt wildcard selection metadata preserves independent occurrence cursors across subsequent submissions.
- [x] Existing key-level selection metadata remains supported as a backward-compatible fallback.
- [x] Regression coverage verifies duplicate sequential placeholders do not advance each other.

## Notes

Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
