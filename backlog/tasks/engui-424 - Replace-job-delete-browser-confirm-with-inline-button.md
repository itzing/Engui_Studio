# ENGUI-424 - Replace job delete browser confirm with inline button

status: done
labels: [desktop, mobile, jobs, ux]

## Goal

Replace browser confirmation popups for deleting a single job from Jobs lists or Job details with an inline two-step delete button.

## Scope

- Desktop Jobs list delete action.
- Desktop Job details delete action.
- Mobile Jobs list delete action.
- Mobile Job details delete action.
- Preserve existing delete APIs and job cleanup behavior.
- Do not change cancel confirmation flows or gallery delete flows.

## Validation

- Focused component regression tests for inline delete confirmation.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify job deletion returns to the previous browser-confirm behavior.

## Result

Implemented across desktop and mobile single-job delete controls. Jobs list and Job details deletion now use a shared inline two-step button: the first click arms the button and shows a check icon, and the second click confirms deletion. Bulk clear, cancel job, and gallery delete confirmation flows are unchanged.
