---
id: engui-160
title: Fix PWA stale cache and image model switching
status: done
priority: high
labels: [pwa, mobile, desktop, create, bug]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary
Fix installed PWA clients staying on stale bundles after deploys and finish removing image model selection dependence on shared global `StudioContext.selectedModel` in the remaining image create paths.

## Desired outcome
- Installed PWA clients reliably update to the latest shell after deploys.
- Image model switching works from workflow-scoped image draft state in both mobile create and desktop image form.
- Safari and installed PWA load the same current client behavior after update.

## Acceptance criteria
- [x] Service worker cache version and update flow are invalidated on deploy
- [x] PWA registration forces a fresh service worker update path and reloads under the new controller
- [x] Mobile image create no longer reads image selected model from shared `StudioContext.selectedModel`
- [x] Desktop image form model switching goes through workflow-scoped draft switching instead of raw global model mutation

## Completion notes

Changes:
- updated `public/sw.js` to `enguistudio-shell-v2`, added `/m/create` to app shell, and switched same-origin asset handling from cache-first to network-first with cache fallback so deployed bundles stop sticking in installed PWAs
- updated `src/components/pwa/PWARegistration.tsx` to register `/sw.js` with a version query, `updateViaCache: 'none'`, call `registration.update()`, and reload once on `controllerchange`
- updated `src/hooks/create/useImageCreateState.ts` to use local workflow-scoped image `selectedModel` state instead of `StudioContext.selectedModel`
- updated `src/components/forms/ImageGenerationForm.tsx` to use local image model state and switch models via `useImageCreateDraftPersistence().switchModel(...)`

Validation:
- `npx vitest --run tests/lib/create-drafts-v2.test.ts tests/lib/persist-create-reuse-draft.test.ts tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
