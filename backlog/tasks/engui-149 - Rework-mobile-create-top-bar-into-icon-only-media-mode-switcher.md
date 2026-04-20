# ENGUI-149 - Rework mobile create top bar into icon-only media mode switcher

## Summary
Replace the current text-heavy mobile Create header with a compact icon-only top bar that matches desktop media-mode affordances more closely.

## Scope
- Remove the current title/subtitle text block from mobile Create.
- Add a top row of icon-only media mode buttons for the same four create modes exposed on desktop.
- Active mode icon should be highlighted.
- Inactive mode icons should be gray.
- Keep advanced settings as a right-aligned icon action in the same row.
- Switching mode should navigate to the corresponding mobile create flow.

## Acceptance Criteria
- Mobile Create top area contains icons only, no title/subtitle text.
- Left-to-right row shows four media mode icons matching desktop create modes.
- Tapping an icon switches to that media mode and visibly highlights the active mode.
- Inactive modes render muted/gray.
- Advanced settings appears as a right-side icon button with the same visual treatment as the current large button.
- Existing create content below the row keeps working after mode switching.
