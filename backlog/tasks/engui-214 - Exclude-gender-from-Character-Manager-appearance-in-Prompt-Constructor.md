# ENGUI-214 - Exclude gender from Character Manager appearance in Prompt Constructor

## Summary
When a character is inserted from Character Manager into Prompt Constructor appearance flows, the generated appearance text must exclude gender labels like `female` or `male`.

## Scope
- update the Character Manager -> Prompt Constructor appearance helper to omit gender
- keep name omission behavior unchanged where it already exists
- cover both direct character pick and random character appearance flows with regression tests

## Acceptance Criteria
- selecting a character from Character Manager fills Prompt Constructor appearance without the character name and without gender
- random character appearance text stored for Prompt Constructor also excludes gender
- existing scene assembly behavior outside Prompt Constructor remains unchanged unless explicitly routed through the constructor helper
