---
id: engui-154
title: Persist mobile create local media via IndexedDB refs
status: done
priority: high
labels: [mobile, create, frontend, pwa]
created_at: 2026-04-20
updated_at: 2026-04-20
completed_at: 2026-04-20
assignee: openclaw
---

## Summary
Persist locally selected mobile create media through IndexedDB-backed references instead of serializing preview payloads into localStorage snapshots.

## Desired outcome
Local images selected from the phone remain durable across mobile create navigation and reloads without depending on fragile `data:` URL persistence.

## Dependencies
- ENGUI-151
- ENGUI-152
- `backlog/specs/unified-create-state-implementation.md`

## Scope
- Add create-media ref types for local uploads.
- Store local blobs in IndexedDB.
- Hydrate stored blobs back into usable client objects for previews and submit flows.
- Implement cleanup for orphaned stored media.
- Define fallback behavior when IndexedDB is unavailable.

## Acceptance criteria
- [x] Local create images are stored as IndexedDB-backed refs, not raw `data:` URLs in serialized draft state
- [x] Selected local media survives route changes inside `/m/create/*`
- [x] Selected local media survives page reload when IndexedDB is available
- [x] Submit flows can resolve IndexedDB-backed media refs back into usable files or blobs
- [x] Orphaned stored media can be cleaned up safely

## Completion notes

Implemented IndexedDB-backed persistence for mobile image-create local media.

Changes:
- extended `ImageCreateDraftSnapshot` with persisted `inputs.primary` and `inputs.secondary` refs
- added `storeCreateFile()` and `resolveCreateMediaRefToFile()` helpers in `src/lib/create/createMediaStore.ts`
- updated `useImageCreateState` so local uploads are stored as `idb-media` refs, snapshots persist those refs, and hydration restores `File` instances plus object-URL previews
- remote scene/job reuse inputs now persist structured `remote-url` refs instead of relying on ad hoc preview-only state
- orphan cleanup continues to use the existing `cleanupOrphanedCreateMedia()` path in the unified create media store

Validation:
- `npx vitest --run tests/lib/image-draft-normalization.test.ts tests/lib/create-media-store.test.ts` ✅
- `npm run build` ✅
