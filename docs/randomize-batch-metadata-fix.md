# Randomize preference and preselected batch seeds

## Problem

Mobile image batches choose unique seeds on the client and submit Randomize=false to prevent server-side re-randomization. This incorrectly persists a disabled preference, so Gallery reuse later restores Fixed even when Randomize was enabled.

## Change

Keep `randomizeSeed` as the user's persisted preference. Add a request-only `seedIsPreselected` control to image submission. The mobile batch passes this control and its unique numeric seed; the server validates the explicit seed and uses it unchanged while saving the original preference. Ordinary image submissions keep server-side randomization. The control is never a saved draft field, model parameter or Gallery metadata field.

Existing batching semantics remain: a multi-image batch uses distinct random seeds even when the single-image toggle is Fixed. This change only repairs preference metadata, not the batch UX. Desktop and mobile reuse continue using the existing shared snapshot path.

## Validation and rollout

Use fake-provider backend tests and intercepted browser submissions only. Verify true/false, single/batch, actual used seed, Gallery round trip and stale draft replacement on desktop/phone/tablet. Build in isolation, preserve the serving build for rollback, commit/push under the owner identity and restart the production service. No database migration, paid generation, or speculative rewrite of historical false flags.


## Verified before rollout

- 60 tests pass across seven files, including real submit helper, batch hook, server validation, persisted job metadata and Gallery snapshot reuse.
- Production build passes in an isolated staging directory.
- 36 browser checks pass against that build: 32 restoration checks and four single/batch submission checks across Chromium and WebKit. All API requests are intercepted; no provider jobs are launched.
- Historical images are unchanged: an existing false flag cannot reliably reveal whether the original UI checkbox was enabled.

## Production verification

Code commit `958150a` was pushed under the owner identity and deployed on 2026-11-13. The restarted service is active; root and mobile Create/Gallery/Jobs return HTTP 200. The same 36 browser checks pass against the deployed build in Chromium and WebKit. Preview and production together provide 72 passing browser checks, without provider execution. The previous build is retained for rollback. These are emulated browser checks, not physical iPhone testing.
