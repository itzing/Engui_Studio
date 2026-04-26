# ENGUI-207 - Add desktop Image Create prompt draft selector

## Summary
Add a desktop-only Prompt Constructor draft selector to Image Create and make generation always re-render from the selected draft.

## Scope
- add a desktop selector for saved Prompt Constructor drafts inside Image Create
- when a draft is selected, disable direct editing of the main prompt field
- on each generate action, fetch the selected draft, re-render its prompt, and use that output for generation
- if the draft uses random character appearance slots, refresh those random picks on every generate before submitting
- keep manual prompt editing available when no draft is selected

## Acceptance Criteria
- desktop Image Create shows a saved prompt-draft selector
- selecting a draft fills the prompt field from that draft and locks the prompt textarea
- clearing the selection returns Image Create to manual prompt editing
- every generate action re-renders the latest selected draft instead of reusing stale prompt text
- scene drafts with random character appearance produce fresh random matching characters on each generate
- tests cover draft selection, prompt locking, and per-generate rerender behavior
