# Desktop Character Manager: image-first overview

## Agreed scope
2026-10-13: user requested an image-first character overview, with editing in a separate tab, and explicitly limited the change to desktop. UI text remains English.

## Design
Two desktop columns: character library and a wide character workspace. Default Overview shows three equal-width image cards: Portrait, Upper body and Full body. Images use their original source where available and object-contain, with fullscreen viewing and the existing per-slot generation controls. A Preview settings toggle beside the tabs keeps model, look selection and prompt inspection available without competing with the images.

Details hosts the existing basics, trait groups, identity visible parts, wardrobe, assistant and version-history editors. The header and Save/Cancel remain shared. Both tab panels stay mounted so unsaved wardrobe fields, disclosure state and character draft survive tab switches. New character enters Details; selecting another saved character enters Overview. Tab switches never save, generate or fetch a new character.

## Alternatives considered
- Larger right sidebar: insufficient central image space and still dominated by editing.
- Separate editor dialog/page: more navigation and avoidable draft-state risks.
- Overview/Details tabs (chosen): directly matches the requested review/edit/return flow.

## Implementation
1. Desktop breakpoint: 1024 CSS px and above. Below it retain the existing stacked manager and compact previews, without tabs.
2. Reuse existing editors and preview actions; use a nested Radix dialog for desktop fullscreen images so the manager focus/pointer trap does not block Close/Previous/Next. Keep the existing mobile fullscreen viewer; no backend, database or prompt changes.
3. Validate desktop sizing at 1024, 1200, 1440 and wide viewports, keyboard tab navigation, draft persistence, missing-preview and queued/failed states, and unchanged mobile layout. Browser checks block generation requests and avoid production writes.
4. Commit/push as the user, run a detached logged production build, restart engui-studio.service and verify live pages/UI.

## Rollback
Revert the feature commit, rebuild and restart the service. No schema/data migration or preview regeneration is required.

## Validation notes
- Browser harness reads existing local API/media, blocks production writes and mocks all preview submissions. No generations or character/outfit writes are sent to the server.
- Both tab panels are force-mounted and hidden when inactive. This preserves the wardrobe editor local draft in addition to the parent character draft.
- Local dev QA uses an isolated checkout and disables background instrumentation. The existing dev bundler otherwise pulls a server-only sharp dependency into instrumentation. This QA-only stub is not part of the application commit.
- Native browser tooling is used because MCP tools are unavailable in this run.
