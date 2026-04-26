# ENGUI-204 - Limit Open in Create to prompt only and update face expression label

## Summary
Refine Prompt Constructor output and Create handoff behavior.

## Scope
- render expression as `Face expression: {value}`
- change `Open in Create` so it transfers only the rendered prompt
- preserve existing Create settings like resolution, randomize, LoRA selection, and other controls

## Acceptance Criteria
- character render uses `Face expression: ...`
- using `Open in Create` updates only the prompt in Create
- Create settings such as resolution, randomize, and LoRA are left unchanged
- tests cover the prompt-only reuse behavior
