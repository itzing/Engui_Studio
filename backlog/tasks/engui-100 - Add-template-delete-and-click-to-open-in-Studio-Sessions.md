# engui-100 - Add template delete and click-to-open in Studio Sessions

## Summary
Allow deleting Studio Session templates and simplify template selection so a template opens when the user clicks the card itself, without a separate Open button.

## Scope
- Add template delete support in Studio Sessions API/server.
- Add a Delete action to template cards.
- Make template cards selectable by clicking anywhere outside action buttons.
- Remove the explicit Open button.
- Preserve Clone and Create run actions.

## Acceptance Criteria
- Users can delete a template from the Studio Sessions templates list.
- Deleting a selected template clears or reassigns selection cleanly.
- Clicking a template card body selects/opens that template.
- Clicking Clone/Create run/Delete does not also trigger card selection accidentally.
- The Open button is removed from template cards.
