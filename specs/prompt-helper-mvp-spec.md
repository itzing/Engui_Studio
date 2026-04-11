# Prompt Helper MVP Spec

## Goal

Add a very small MVP prompt assistant to Engui for image generation.

The user can click a `Prompt Helper` button under the image prompt field, type an instruction like `add more drama`, submit it, and get the prompt rewritten immediately into the main prompt field.

This MVP must support provider abstraction from day one, but only implement one provider initially:
- `local`
- compatible with a local OpenAI-compatible `/v1/chat/completions` server
- intended first target model: `TrevorJS/gemma-4-E2B-it-uncensored-GGUF`

## Scope

### In scope
- Image generation form only
- New `Prompt Helper` button under the prompt textarea
- Modal for user instruction
- Local provider settings in `SettingsDialog`
- New backend endpoint for prompt improvement
- Provider abstraction layer with one implementation: `local`
- Settings test action for the local provider
- Replace the current prompt immediately on success

### Out of scope
- Video form integration
- Prompt history
- Streaming
- Provider presets
- Multiple providers beyond `local`
- Function calling / structured tool calls to the LLM
- Prompt version diff UI

## UX

## ImageGenerationForm

Target file:
- `src/components/forms/ImageGenerationForm.tsx`

Behavior:
- Show a `Prompt Helper` button under the main prompt textarea.
- The button opens a small modal.
- The modal contains:
  - title: `Prompt Helper`
  - one textarea for user instruction
  - `Cancel` button
  - `Apply` button
- `Ctrl+Enter` / `Cmd+Enter` submits from the modal.
- While request is running:
  - the action button shows loading state
  - repeated submits are blocked
- On success:
  - replace the main prompt field immediately with returned prompt
  - close modal
- On failure:
  - show error message
  - keep modal open
  - keep typed instruction so user can retry

### Enable / disable rules
- `Prompt Helper` button is enabled even if the main prompt is empty.
- It is disabled only when:
  - provider is not configured, or
  - a helper request is already in progress

## Empty prompt behavior

Two modes must be supported:

1. **Rewrite mode**
- if current prompt is non-empty
- provider receives current prompt + user instruction
- expected result: rewritten prompt

2. **Generate mode**
- if current prompt is empty
- provider receives user instruction only
- expected result: newly generated prompt

## Settings

Target files:
- `src/components/settings/SettingsDialog.tsx`
- `src/lib/context/StudioContext.tsx`
- `src/app/api/settings/route.ts`
- `src/lib/settingsService.ts`

Add a new settings section under the existing RunPod section.

### New settings shape

Add to `StudioSettings`:

```ts
promptHelper?: {
  provider?: 'disabled' | 'local';
  local?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
}
```

### MVP settings fields
- provider
- local base URL
- local model
- local API key (optional)

### UI requirements
- Section title: `Prompt Helper`
- Provider select with:
  - `disabled`
  - `local`
- Show local fields only when provider is `local`
- Add `Test` button in this section

### Test behavior
The test action must:
- send a small real request through the same local provider path style
- expect a non-empty text result
- show success or error

## Backend API

Add endpoint:
- `POST /api/prompt-helper/improve`

### Request

```json
{
  "prompt": "current prompt or empty string",
  "instruction": "user instruction",
  "modelId": "z-image"
}
```

### Response

```json
{
  "success": true,
  "improvedPrompt": "final rewritten prompt"
}
```

### Validation
- `instruction` is required and must be non-empty
- `prompt` may be empty
- `modelId` is optional in behavior but should be accepted and forwarded into provider prompt construction
- reject if provider is `disabled` or incomplete

## Provider abstraction

Add a small internal provider layer, for example:
- `src/lib/promptHelper/`

Suggested files:
- `src/lib/promptHelper/types.ts`
- `src/lib/promptHelper/index.ts`
- `src/lib/promptHelper/localProvider.ts`

### Suggested interface

```ts
export interface PromptHelperRequest {
  prompt: string;
  instruction: string;
  modelId?: string;
}

export interface PromptHelperResult {
  improvedPrompt: string;
}

export interface PromptHelperProvider {
  improve(request: PromptHelperRequest): Promise<PromptHelperResult>;
  testConnection(): Promise<void>;
}
```

## Local provider contract

First supported provider:
- OpenAI-compatible `/v1/chat/completions`

### Request target
- `${baseUrl}/v1/chat/completions`

### Request format
Use normal chat completions JSON.

Suggested request:
- `model`: settings.promptHelper.local.model
- `messages`:
  - system
  - user
- no streaming in MVP

### System prompt requirements
The system prompt must force:
- English output only
- output only the final prompt
- no explanations
- no markdown
- no surrounding labels

### Rewrite mode user payload
When `prompt` is non-empty, provider prompt should clearly mean:
- here is the current image prompt
- here is the user instruction
- rewrite the prompt accordingly
- return only the final rewritten prompt

### Generate mode user payload
When `prompt` is empty, provider prompt should clearly mean:
- create a new image prompt from the user instruction
- return only the final prompt

### Response parsing
Do not rely on function calling for MVP.

Use plain text extraction from the OpenAI-compatible response.
Then normalize by:
- trim whitespace
- strip wrapping quotes if the whole response is quoted
- strip triple backticks if present

If final text is empty, treat as error.

## Data flow

1. User clicks `Prompt Helper`
2. Modal opens
3. User enters instruction
4. Frontend calls `POST /api/prompt-helper/improve`
5. API loads configured provider from settings
6. API routes to provider implementation
7. Local provider calls local OpenAI-compatible LLM
8. API returns `improvedPrompt`
9. Frontend replaces main prompt field immediately
10. Modal closes

## Error handling

### UI
- show a visible error in modal on failure
- keep instruction text intact
- allow retry

### Backend
Return clear errors for:
- provider disabled
- provider not configured
- local endpoint unreachable
- model missing or rejected by provider
- empty model response
- malformed OpenAI-compatible response

## Suggested implementation files

### Frontend
- `src/components/forms/ImageGenerationForm.tsx`
- possibly add a tiny reusable modal component if needed, but avoid over-abstracting

### Settings
- `src/components/settings/SettingsDialog.tsx`
- `src/lib/context/StudioContext.tsx`
- `src/app/api/settings/route.ts`
- `src/lib/settingsService.ts`

### Backend
- `src/app/api/prompt-helper/improve/route.ts`
- `src/app/api/prompt-helper/test/route.ts`
- `src/lib/promptHelper/*`

## Default local model target

Initial intended model:
- `TrevorJS/gemma-4-E2B-it-uncensored-GGUF`

This spec does not require Engui to launch the model itself.
It only requires Engui to talk to a configured local OpenAI-compatible endpoint.

## MVP acceptance criteria

1. A new `Prompt Helper` button exists under the image prompt textarea.
2. Clicking it opens a modal with instruction textarea.
3. Empty main prompt is allowed.
4. Submitting sends request to `POST /api/prompt-helper/improve`.
5. Provider is selected from settings.
6. Only `local` provider is implemented in MVP.
7. Local provider uses OpenAI-compatible `/v1/chat/completions`.
8. On success, the returned prompt immediately replaces the prompt field.
9. On failure, the modal stays open and instruction text is preserved.
10. Settings include provider, base URL, model, optional API key, and `Test` action.
11. `Test` performs a real mini-request and reports success/error.
12. No function-calling dependency is required in MVP.
