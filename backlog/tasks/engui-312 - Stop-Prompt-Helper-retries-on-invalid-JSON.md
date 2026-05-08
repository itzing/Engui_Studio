# ENGUI-312 - Stop Prompt Helper retries on invalid JSON

Status: done

## Request
When Prompt Helper receives invalid JSON from the model, do not retry. Surface the error immediately after the first failed provider response.

## Scope
- Prompt Helper provider error classification
- `/api/prompt-helper/improve` response status/payload
- Keep unrelated network/provider errors unchanged

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
