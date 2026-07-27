# Create Video Prompt Editor Modal Plan

## Goal

Bring the desktop Create Video prompt editing experience in line with Create Image by adding the same large modal editor for long prompts.

## Implementation

1. Reuse `PromptTemplateTextarea` in `VideoGenerationForm` so prompt wildcard/template autocomplete works inside the editor.
2. Add a video prompt editor draft state that opens from the desktop prompt textarea focus.
3. Save the draft back to the actual video prompt on `Save prompt` or Ctrl/Cmd+Enter.
4. Keep Cancel as a non-destructive close and leave mobile routes on the existing inline textarea.

## Validation

- Focused component coverage for opening the editor, saving, and canceling.
- Targeted lint/type/build checks.
