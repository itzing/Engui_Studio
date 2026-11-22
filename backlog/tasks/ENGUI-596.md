---
id: ENGUI-596
title: Batch Cards Pick ZIP export and batch-wide missing selection
status: In Progress
created_date: '2026-11-22 19:21'
labels: [batch, cards, export]
---

## Request
Owner14678: Export ZIP of all picked originals named by the new source row `id`; rename Select missing in view to Select missing in batch and make its scope unambiguous.

## Plan and acceptance
- Validate optional id for backward-compatible old imports; consistent across a card, unique per card, filename-safe. Export preserves it. ZIP requires ids for selected cards.
- Export all current Picks from the whole batch, original image bytes/extensions, no thumbnails or superseded attempts. Reject incomplete picks, missing originals, invalid/duplicate filenames and foreign-workspace access.
- Private temporary streaming ZIP snapshot, cleaned on completion/cancel/error; no public export artifact or outbound fetching.
- Button Select missing in batch selects missing variants across all cards, regardless of filters; selection stays separate from Pick.
- Isolated archive/API tests and Chromium/WebKit download/selection checks. No paid generations.
- Commit/push/build/redeploy, retain previous .next rollback. No DB migration.

## Validation before release
27 isolated service/parser/archive tests pass, including original image hashes, CRC, scoping and temporary-file cleanup. Production build succeeds. Chromium + WebKit: 46 workflow checks pass, including hidden-card ZIP download and filtered whole-batch missing selection. Full repository tsc retains pre-existing errors; no diagnostics in changed files. No paid generations.
