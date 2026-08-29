# LoRA Manager Base Model Autosave Fix Plan

## Scope

Fix the shared LoRA Manager base model dropdown used wherever the manager dialog opens. The dropdown should remain an autosave control, without a separate save button.

## Behavior

- Keep saving through `PATCH /api/lora/:id` when the user changes `Base model`.
- Accept `baseModel`-only PATCH payloads without requiring `targetOverride`.
- Treat an explicit saved `baseModel` as authoritative.
- Use automatic high/low pair detection only as a legacy fallback when a LoRA record has no explicit model metadata.
- Show `LoRA model updated.` after a successful model change so the autosave is visible.

## Validation

- Add focused component coverage for changing the base model dropdown.
- Add API coverage for `PATCH /api/lora/:id` with a `baseModel`-only payload.
- Add model filter coverage proving explicit image base models override WAN pair auto-detection.
- Run focused tests, diff check, targeted ESLint, production build, service restart, and smoke checks.
