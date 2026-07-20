# Original and Resolved Prompt Tabs Plan

## Objective

Users need to see the original authored prompt and the final resolved prompt in Job Details and Gallery Details. When txt2img reuse is triggered, the currently selected prompt tab should become the prompt in the Create Image draft.

## Surface Scope

- Desktop Job Details dialog.
- Desktop Gallery Details dialog.
- Mobile Job Details route.
- Mobile Gallery Details route.

## Implementation

1. Add a shared prompt-version helper that reads:
   - original prompt from `promptTemplate`, `prompt`, or the record fallback;
   - resolved prompt from `resolvedPrompt` only when it differs from the original.
2. Expose resolved prompt metadata from gallery asset APIs, because desktop/mobile gallery details currently receive only the normalized prompt.
3. Add compact `Original` / `Resolved` tabs in prompt blocks only when a resolved prompt exists.
4. Keep `Original` selected by default.
5. Pass the selected prompt to txt2img reuse requests as a prompt override.
6. Apply prompt overrides only to txt2img payloads, leaving img2img/img2vid behavior unchanged.

## Validation

- Unit coverage for prompt-version extraction.
- API coverage for txt2img prompt overrides on job and gallery reuse routes.
- Component-level coverage for the mobile/details prompt tabs where practical.
- Production build and service restart after implementation.
