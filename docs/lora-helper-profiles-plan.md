# LoRA Helper Profiles Plan

## Goal

Let users attach practical prompt helper text and recommended WAN high/low weights to LoRA catalog entries so they can inspect and copy the right trigger snippets while building image, video, and video sequence prompts.

## Behavior

- Single LoRAs can have notes.
- Complete high/low pairs can have one shared notes field and optional recommended high/low weights.
- Notes are plain text with an 8000 character limit.
- In picker popovers, notes are split into clickable groups by blank lines.
- Clicking a group copies only that group to the clipboard.
- Pair recommended weights are shown as an explicit apply action.
- Prompt text is never inserted automatically.
- Recommended single LoRA weights are intentionally out of scope.

## Storage

- Add a `LoRAHelperProfile` table.
- Pair profiles are tied to `highLoraId` and `lowLoraId`.
- Single profiles are tied to `loraId`.
- Helper profiles are serialized through `/api/lora` with the LoRA catalog.

## Validation

- API tests for helper profile validation/upsert.
- Component tests for note grouping/copy and pair weight apply.
- Prisma generate, validate, db push.
- Production build, service restart, and HTTP smoke checks.
