# engui-201.4 - Build Character Manager preview generation and persistence UI

## Summary
Turn the existing Character Manager preview rail from a placeholder scaffold into a working preview surface with generate/regenerate actions, status display, and persisted images.

## Scope
- Replace placeholder preview cards with real preview lifecycle UI.
- Show current image, status, and error state per slot.
- Add Generate/Regenerate actions for portrait, upper-body, and full-body slots.
- Refresh from persisted character state instead of relying on transient client-only preview data.

## Acceptance Criteria
- Users can generate each preview slot from Character Manager.
- Reloading the page shows the previously materialized preview images.
- Failed preview jobs surface a visible error state.
