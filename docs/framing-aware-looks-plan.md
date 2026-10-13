# Implementation plan
## ENGUI-559 — compiler and metadata
1. Define region/part validation, source fingerprints and framing policies.
2. Compose structured identity/outfit snapshots while retaining full source strings.
3. Filter fragments by effective framing plus explicitly visible pose regions; account for face covering and exposed jaw.
4. Add offline regression tests and actionable classification errors.
## ENGUI-560 — integration and editors
1. Add minimal pose/session metadata persistence and outfit metadata persistence.
2. Version character composition changes as well as traits.
3. Add responsive parts editors for Characters, wardrobe/custom outfit and pose visibility.
4. Route Characters previews and Studio revision assembly through the shared compiler.
5. Remove conflicting automatic full-body helper from structured Studio launches; keep model-specific controls intact.
6. Expose a free composed-prompt preview and preserve historical snapshots.
## ENGUI-561 — curated migration and delivery
1. Export live scoped content and curate seven identity/outfit part sets.
2. Preserve original records; migrate in a transaction and prove idempotence on a copy.
3. Populate explicit visible hands/arms for Showdown Portrait poses without changing pose text or IDs.
4. Upgrade only pristine compatible draft look snapshots; never modify completed revisions/results.
5. Run focused tests, integration and desktop/mobile checks with provider calls disabled.
6. Commit with Artem's identity, push, back up, migrate production, build and restart service.
7. Verify scoped API responses, historical table checksums, crop outputs and service health; record release report.
