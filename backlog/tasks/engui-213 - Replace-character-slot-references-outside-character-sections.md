# ENGUI-213 - Replace character slot references outside character sections

## Summary
Keep `Character N` headers unchanged inside Prompt Constructor character sections, but replace `Character N` references with the corresponding character name everywhere else in the rendered prompt.

## Scope
- preserve existing `Character N: Name` formatting inside character blocks
- replace `Character N` with the slot's resolved name in scene, interaction, composition, environment, style, and constraints sections
- keep fallback behavior safe when a slot has no explicit name
- update regression coverage for both preserved character headers and renamed external references

## Acceptance Criteria
- character sections still render `Character N` headers exactly as before
- non-character sections resolve `Character N` references to the matching character name when available
- regression tests cover both the preserved header behavior and the external reference replacement
