---
id: engui-154
title: Persist mobile create local media via IndexedDB refs
status: planned
priority: high
labels: [mobile, create, frontend, pwa]
created_at: 2026-04-20
updated_at: 2026-04-20
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
- [ ] Local create images are stored as IndexedDB-backed refs, not raw `data:` URLs in serialized draft state
- [ ] Selected local media survives route changes inside `/m/create/*`
- [ ] Selected local media survives page reload when IndexedDB is available
- [ ] Submit flows can resolve IndexedDB-backed media refs back into usable files or blobs
- [ ] Orphaned stored media can be cleaned up safely
