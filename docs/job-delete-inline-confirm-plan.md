# Job Delete Inline Confirm Plan

## Goal

Single-job deletion should not open a browser confirmation popup. Pressing a delete button should arm that same button, show a check icon, and delete only on the second press.

## Scope

- Desktop Jobs list cards.
- Desktop Job details dialog.
- Mobile Jobs list rows.
- Mobile Job details screen.

Bulk clear, cancel job, gallery trash, and other destructive flows stay unchanged.

## Implementation Notes

- Add a shared inline delete confirmation button for consistent icon/label behavior.
- The first press changes the button into confirm mode.
- Confirm mode resets when the job changes, after a short timeout, or after confirmation.
- The second press calls the existing delete handler.

## Validation

- Focused component tests for the shared two-step button.
- Targeted ESLint for touched files.
- Production build, service restart, and HTTP smoke checks.
