---
id: ENGUI-617
title: MCP Gallery trash, restore and identity-preserving Draft promotion
status: In Progress
created_date: '2026-11-25'
labels: [mcp, gallery]
---

## Scope
Owner14970: agents must remove obsolete Drafts and move them to Added/common without duplicates, understanding changed Gallery status. MCP-only contract/behavior; shared UI records remain visible normally. No automatic cleanup of existing user duplicates, permanent erasure or paid inference.

## Design
- Gallery detail plus revision-checked delete-to-trash/restore with curate scope, receipts and workspace isolation.
- Save a Gallery source into another bucket by moving the same asset ID; save a known Job output reuses/promotes its saved asset. Explicit action/previousBucket/current status returned.
- Legacy membership conflicts return existing asset ID without silently merging/deleting either record.
- Gallery search filters/read results and batch preservation expose live bucket/trash status; late auto-preservation reuses promoted membership.
- Preserve original bytes, generation provenance, plan snapshots and references on move. Trashed source is unavailable for future generation; restoration explicit.

## Validation / rollback
Isolated DB/in-process and HTTP MCP checks for idempotency, races, permissions, cross-workspace boundaries, immutable provenance, legacy conflicts, full-original access and current batch status. Production build and existing MCP regression suites. Retain previous .next; no schema migration or provider change.

## Verified before deployment
- 16 targeted Gallery lifecycle tests; 238 total MCP/image-Vibe checks passed on isolated databases with network/provider stubs.
- Updated discovery assertions for 38 total tools and 20 read-only tools (3 new Gallery tools).
- Candidate MCP2.7 passed27 real SDK/HTTP checks: promotion, read/list, trash/restore, revision rejection, isolation, original-byte retention, no Jobs.
- Production build `G15gV2nU2co2JKQ-0TE_H` passed; no added TypeScript diagnostics. Immutable source overlay captured before slow checks.
- Legacy pre2.7 save receipts remain readable; optional new save-result fields are omitted on historical receipts. Fresh get_gallery_asset reports current state.
- Named K6 C records checked read-only: same original hash/source output; neither altered.
- Evidence `/home/engui/engui-runs/engui-617-20261125`.
