# ENGUI-58 - Make prompt helper robust to llama reasoning and non-JSON output

## Summary

The local Prompt Helper uses llama.cpp with a Gemma model. The provider may return text in `message.reasoning_content` instead of `message.content`, and it may spend the whole completion budget on chain-of-thought without ever emitting the final JSON object.

## Problem

Current failure modes:
- Prompt Helper provider returned empty text, because only `message.content` was parsed
- Prompt Helper provider returned invalid JSON, because the model emits reasoning prose and can stop at `finish_reason: length` before the JSON block

## Required changes

- Prefer OpenAI-compatible JSON response mode when calling the local provider
- Continue reading `message.content`, but also support `message.reasoning_content`
- Add a resilient fallback parser for common non-JSON outputs from llama/Gemma
- Keep the public Prompt Helper API contract unchanged

## Acceptance criteria

- `/api/prompt-helper/improve` succeeds against the local llama.cpp Gemma provider
- valid prompt/negativePrompt output is returned even when the model uses reasoning_content
- parser tolerates common prose wrappers and extraction scenarios
