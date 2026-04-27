# ENGUI-209 - Label local action in Prompt Constructor render

## Summary
Render the character `localAction` field with an explicit `Local action:` label in Prompt Constructor output.

## Scope
- update Prompt Constructor character render formatting for `localAction`
- keep existing multiline character layout unchanged apart from the new label
- add or update a regression test for the rendered output

## Acceptance Criteria
- when `localAction` has a value, rendered prompt shows `Local action: {value}`
- empty `localAction` does not add an empty labeled line
- existing Prompt Constructor render behavior stays unchanged otherwise
