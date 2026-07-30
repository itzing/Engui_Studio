# engui-495 - Fix wildcards dialog list scrolling

## Status

Done

## Context

On desktop, Tools > Wildcards can contain enough wildcard entries that the left panel expands the dialog internals. That pushes the right editor footer actions below the popup bounds.

## Acceptance Criteria

- [x] The wildcard list scrolls inside the existing dialog height when many entries exist.
- [x] The `New` action stays visible and does not scroll with the list.
- [x] The right editor footer actions remain inside the popup.
- [x] Focused verification covers the dialog layout classes.

## Result

Moved the desktop Wildcards dialog `New` action into the header and constrained the left wildcard list to an internal scroll area. The dialog content and left panel now use explicit `min-h-0`/overflow constraints so long wildcard lists do not push the editor footer beyond the popup.

## Rollback

Revert the implementation commit, run `npm run build`, then restart `engui-studio.service`.
