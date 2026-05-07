# engui-201.5 - Surface character portrait thumbnails across selectors and cards

## Summary
Use the character portrait preview as a reusable visual thumbnail in the rest of the product.

## Scope
- Extend major character consumers to display portrait thumbnails.
- Cover at least Prompt Constructor, Scene Manager, Studio Sessions, and other existing character pickers that already consume `CharacterSummary`.
- Keep the first pass visually small and non-disruptive.

## Acceptance Criteria
- Downstream character selectors can show the character visually.
- Portrait thumbnails stay attached after reload and after the character is reopened.
- Missing previews degrade gracefully to text-only UI.
