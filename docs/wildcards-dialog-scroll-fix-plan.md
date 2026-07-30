# Wildcards Dialog Scroll Fix Plan

## Goal

Keep the desktop Tools > Wildcards dialog bounded when a workspace has many wildcard records.

## Implementation

1. Move the `New` wildcard action from the left list into the dialog header controls so it remains visible.
2. Make the two-column content area and left panel explicitly `min-h-0`.
3. Make only the wildcard list area scroll with `flex-1 overflow-y-auto`.
4. Preserve the existing right editor footer and save/delete actions.

## Validation

- Add a focused component test that asserts the bounded list scroller and header `New` action.
- Run targeted ESLint, Prisma validation, production build, service restart, and smoke checks.
