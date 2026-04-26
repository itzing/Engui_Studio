# ENGUI-205 - Unify Character Manager gender toggle with Prompt Constructor on desktop

## Summary
Make Character Manager desktop gender behavior match Prompt Constructor.

## Scope
- use the same male/female toggle style in Character Manager desktop UI
- default new Character Manager entries to `female`
- migrate existing characters so gender becomes `female`
- keep storage aligned with Prompt Constructor semantics (`male` / `female`)

## Acceptance Criteria
- Character Manager desktop shows the same style of gender toggle as Prompt Constructor
- new characters default to `female`
- existing characters are migrated to `female`
- tests cover desktop UI behavior and persistence
