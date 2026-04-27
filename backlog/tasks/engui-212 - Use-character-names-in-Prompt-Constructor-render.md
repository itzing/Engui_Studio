# ENGUI-212 - Use character names in Prompt Constructor render

## Summary
Replace generic `Character N` references in Prompt Constructor scene rendering with each slot's actual rendered name when available.

## Scope
- use the character's actual name in the sceneTemplateV2 rendered output header
- fall back to role, then to the existing numbered label when no name exists
- reuse the same resolved reference in relation lines
- update regression tests for rendered prompts and create handoff flows

## Acceptance Criteria
- named characters render as their actual names instead of `Character N`
- relations use the same resolved character reference
- fallback remains stable when a slot has no name
