# Gallery Implementation Decisions

## Status

- Status: Implemented snapshot
- Scope: Current web/backend gallery behavior in Engui Studio
- Purpose: Record the decisions already embodied in code so future backend, frontend, and mobile work can build on a stable baseline

## Referenced specs

- Product spec: `/var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-product-spec.md`
- API contract: `/var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-api-contract.md`
- Implementation plan: `/var/lib/openclaw/.openclaw/workspace/docs/engui-gallery-implementation-plan.md`

## 1. Asset identity and scope

### Decision

Gallery assets are workspace-scoped records in `GalleryAsset`.

### Current implementation

Each asset stores:

- `id`
- `workspaceId`
- `type`
- `originKind`
- `sourceJobId`
- `sourceOutputId`
- `contentHash`
- `originalUrl`
- `previewUrl`
- `thumbnailUrl`
- `favorited`
- `trashed`
- `userTags`
- `autoTags`
- `generationSnapshot`
- `derivativeStatus`
- `enrichmentStatus`
- `addedToGalleryAt`
- `updatedAt`

### Why

This keeps Gallery independent from Jobs while still preserving enough linkage for UI state and migration paths.

### Notes

- `sourceJobId` and `sourceOutputId` are treated as traceability fields, not hard dependencies.
- The durable identity rule is `workspaceId + contentHash`, not job identity.

## 2. Dedupe strategy

### Decision

Duplicate detection uses exact file bytes hashed with SHA-256 and scoped by workspace.

### Current implementation

`POST /api/gallery/assets/from-job-output`:

1. resolves the selected output from `jobId + outputId`
2. reads the output bytes
3. computes `sha256`
4. checks `workspaceId_contentHash`
5. returns the existing asset when a duplicate is found

### Why

This makes `Add to Gallery` idempotent and avoids duplicate curated assets when the same output is saved repeatedly.

## 3. Storage ownership

### Decision

Gallery copies saved media into gallery-owned storage under public generations.

### Current implementation

Saved assets are written to:

- `public/generations/gallery/<workspaceId>/<contentHash>.<ext>`

Generated derivative thumbnails for video are written to:

- `public/generations/gallery/<workspaceId>/derived/<assetId>-<suffix>.jpg`

### Why

This separates curated gallery media from transient job outputs and lets jobs be deleted later without breaking gallery access.

## 4. Job Details to Gallery contract

### Decision

The web client saves to Gallery using `jobId + outputId`, and job detail responses expose gallery-awareness per normalized output.

### Current implementation

`GET /api/jobs/[id]` returns normalized `outputs[]` with:

- `outputId`
- `type`
- `url`
- `previewUrl`
- `thumbnailUrl`
- `alreadyInGallery`
- `galleryAssetId`

The mapping is derived by `sourceOutputId` from existing gallery assets for the same job.

### Why

This removes raw client-side path guessing and keeps `Add to Gallery` and `Already in Gallery` behavior stable across media types.

## 5. Generation snapshot policy

### Decision

Gallery stores a compact immutable generation snapshot at asset creation time.

### Current implementation

`generationSnapshot` is serialized from job options plus selected canonical fields such as:

- `prompt`
- `modelId`
- `endpointId`
- mode-specific options from `job.options`

### Why

This is enough for search enrichment now and preserves backend-owned generation context for future reuse/open-in flows.

### Notes

The current snapshot is pragmatic rather than fully normalized to the aspirational API contract.

## 6. Enrichment strategy

### Decision

Auto-tag enrichment exists today as local server-side logic with explicit rerun and bulk backfill support.

### Current implementation

- helper: `src/lib/galleryEnrichment.ts`
- single rerun: `POST /api/gallery/assets/[id]/enrich`
- bulk backfill: `POST /api/gallery/assets/backfill`
- create flow currently calls enrichment inline after asset creation

Enrichment extracts tags primarily from:

- `generationSnapshot`
- `prompt`
- `modelId`
- `stylePreset`
- `aspectRatio`
- orientation-derived hints

### Why

This provides immediate search value without introducing a full queue/worker system yet.

### Notes

The implementation plan originally preferred a non-blocking async pipeline. Current code is a transitional step: local and synchronous at create time, but with backfill and rerun primitives already in place.

## 7. Derivative generation strategy

### Decision

Derivative generation is asynchronous at the app level using a fire-and-forget helper, not a separate worker.

### Current implementation

- helper: `src/lib/galleryDerivatives.ts`
- queue trigger: `queueGalleryDerivatives(asset.id)` after asset creation
- bulk backfill: `POST /api/gallery/assets/derivatives/backfill`

Status lifecycle:

- `pending`
- `processing`
- `completed`
- `failed`

Media behavior:

- image: preview stays usable, thumbnail falls back to original when needed
- audio: preview remains the original asset URL
- video: thumbnail is generated with FFmpeg when the original file is locally accessible and FFmpeg is available

### Why

This keeps save-to-gallery fast enough while enabling derivative catch-up and explicit repair for older assets.

### Notes

This is queue-like behavior, but not yet infra-grade background processing.

## 8. Gallery list and search behavior

### Decision

Gallery list is lightweight, workspace-scoped, and currently uses page/limit pagination rather than cursor pagination.

### Current implementation

`GET /api/gallery/assets` supports:

- `workspaceId` required
- `includeTrashed`
- `type`
- `favoritesOnly`
- `q`
- `sort`
- `page`
- `limit`

Search is token-based and currently matches against:

- `id`
- `sourceJobId`
- `sourceOutputId`
- `userTags`
- `autoTags`

### Why

This is sufficient for the current web panel and makes search immediately useful after enrichment.

### Notes

The product spec also mentions prompt/model search and cursor pagination. Those are not yet implemented in the current list API.

## 9. Editable vs immutable fields

### Decision

Only user-facing asset management fields are editable after creation.

### Current implementation

Editable today:

- `favorited`
- `trashed`
- `userTags`

Mutable via dedicated endpoints:

- `POST /api/gallery/assets/[id]/favorite`
- `POST /api/gallery/assets/[id]/trash`
- `POST /api/gallery/assets/[id]/tags`

Not treated as user-editable:

- `contentHash`
- `generationSnapshot`
- `sourceJobId`
- `sourceOutputId`
- `originalUrl`

### Why

This keeps asset identity and provenance stable while allowing gallery curation.

## 10. Current gaps versus target contract

### Not implemented yet

- dedicated detail endpoint: `GET /api/gallery/assets/:assetId`
- server-side open-in prefill endpoints
- permanent delete / empty trash lifecycle
- separate async enrichment worker/queue
- fully normalized detail payload with capabilities/media blocks
- mobile handoff contract hardening

## 11. Commits that established the current baseline

- `af6629d` `feat(gallery): add local enrichment flow`
- `6667464` `feat(gallery): add enrichment backfill flow`
- `0cd4a32` `feat(gallery): add async derivatives flow`
- `6664ce0` `test(gallery): add API contract coverage`
- `c31b51c` `test(gallery): cover lifecycle endpoints`
- `6f471bb` `test(gallery): extend compatibility coverage`

## 12. Practical conclusion

The current Gallery baseline is intentionally pragmatic:

- stable enough for the existing web UI
- reusable enough for future contract hardening
- not yet the final mobile-grade API surface

Future work should treat this document as the description of what is implemented now, not as the final desired architecture.
