---
id: engui-161
title: Add desktop z-image multi LoRA UI
status: done
priority: high
labels: [desktop, create, z-image, lora]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary
Add desktop create-form support for up to 4 LoRA slots for `z-image`, while keeping the existing multi-LoRA payload contract and wiring reuse/persistence so previously selected slots round-trip correctly.

## Desired outcome
- Desktop `z-image` create form exposes up to 4 LoRA selectors with independent weights.
- Submitting desktop `z-image` sends up to 4 LoRA entries in the existing payload contract.
- Reuse into desktop `txt2img` restores all supported desktop `z-image` LoRA slots.

## Acceptance criteria
- [x] Desktop `ImageGenerationForm` shows 4 LoRA selectors for `z-image`
- [x] Submit path serializes up to 4 `z-image` LoRA entries
- [x] Desktop reuse restores `z-image` LoRA slots and weights from persisted options
- [x] Tests and production build pass

## Completion notes

Changes:
- expanded desktop `z-image` model parameters to expose 4 LoRA selectors and 4 independent weights in `src/lib/models/modelConfig.ts`
- updated `ImageGenerationForm` numeric handling so all `loraWeight*` fields accept signed decimal typing cleanly
- updated `src/app/api/generate/route.ts` to serialize up to 4 `z-image` LoRA entries into the existing multi-LoRA payload contract and persist reusable slot metadata via `zImageLoraSlots`
- updated `src/lib/create/persistCreateReuseDraft.ts` to restore up to 4 desktop `z-image` LoRA slots from current metadata and normalize legacy broken single-slot values during reuse
- extended `tests/lib/persist-create-reuse-draft.test.ts` with multi-slot restoration coverage

Validation:
- `npx vitest --run tests/lib/persist-create-reuse-draft.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-drafts-v2.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
