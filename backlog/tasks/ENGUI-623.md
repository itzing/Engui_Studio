---
id: ENGUI-623
title: MCP-only regional Krea2 LoRA on existing endpoint
status: Done
created_date: '2026-11-26'
labels: [mcp, krea2, runpod]
---

Approved owner15094 plus polygons. MCP only; no desktop/mobile UI.
Regions: normalized rectangles, normalized polygon vertices, arbitrary aligned grayscale image masks; per-region prompts/Character resolution and compatible LoRA weights.
Freeze and revalidate dependencies/masks/prompts; encrypted transport; prepared-only provider boundary; existing LoRA leases and ordinary/i2i/Identity Edit unchanged.
Pin regional plugin in existing image. Tests for access, validation, stale plans, encryption interoperability, geometry, graphs, and sequential mode isolation. Small GPU validation. Rollback previous image and app build. No new endpoint or model disk.


## Completed 2026-11-27 UTC
- Application35f4efe; worker497d38f6121919a357ffbac74d0764dbb1c26d0c. Existing endpoint9s7wwwaorev5h6 now uses image suffix497d38f61. Workers/GPU/scaling/mounts/env unchanged.
- MCP2.9 installed with rectangles, polygons and aligned grayscale image masks. App build -cpTlYyNIiSQkGX92G2-v, previous jlst9AB1GHutc-Ol3PxjC retained.
- Passed23 worker checks,15 new MCP integration checks,97 regressions, native Comfy Krea2 CPU plugin tests through24b. Scoped lint0 errors, no new TS errors versus existing baseline; production build passed.
- Live encrypted single-adapter polygon generation and ordinary generation completed,512x512 nonblank decrypted outputs. These ran on different workers; per-model patch/unpatch isolation is covered by native CPU tests, not claimed as same-worker GPU proof.
- Installed HTTP MCP2.9 discovery and rectangle/polygon frozen plans verified without inference. Existing Dataset Identity bridge remains ready; Engui and Dataset Studio services active. No test images added to Gallery/Drafts.
- Owner explicitly postponed the two-character likeness test: second LoRA is still training. No claim of verified pair likeness.
- Private audit/rollback directory /home/engui/engui-runs/engui-623-20261126. Public contract: docs/krea2-regional-mcp.md.
