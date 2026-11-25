---
id: ENGUI-616
title: Desktop central preview loading progress and stale-image isolation
status: In Progress
created_date: '2026-11-25'
labels: [desktop, jobs, media]
---

## Scope
Owner14957: on Desktop Job navigation, immediately hide the previous image and show loading progress for the currently selected image. Owner also requested highlighting the current Job in the right panel, synchronized with hover/arrow navigation and loading/error state. Desktop central/right panels only; no mobile, MCP, provider, or paid-generation changes.

## Design
Key the desktop image request by workspace, preview identity and source. Same-origin image downloads expose actual progress, unknown length uses an indeterminate indicator; keep the image hidden until the browser has loaded it. Direct cross-origin/data/blob sources retain native image loading. Cancel obsolete downloads, revoke owned Blob URLs, ignore late events, and provide explicit Retry on failure. Preserve Fit/1:1, hover/keyboard navigation and media actions. MainLayout passes the actual center preview Job ID to RightPanel for a visible highlight and aria-current; Gallery/Video Edit clear the Job marker.

## Validation
Focused component tests for delayed switching, rapid races, progress with/without total, errors/retry, cached load and unmount cleanup. Throttled Chromium/WebKit proof against actual Desktop with synthetic intercepted media, isolated production build and installed-version check. No production data writes or GPU jobs.

## Verified before deployment
- 31 focused unit/regression checks passed.
- Chromium and WebKit: 18 actual-browser checks each (36 total), with delayed/unknown-length media, races, Retry, navigation and selection; all API writes blocked.
- Isolated production build passed: `CMuszCAf_WpR3cwKSsreN`. No added TypeScript diagnostics versus baseline.
- Evidence: `/home/engui/engui-runs/engui-616-20261125` and workspace `runs/engui-616-20261125`.

## Rollback
Keep the serving .next build before promotion. Revert feature commit or restore prior build and restart only engui-studio.service; no database migration or content rollback.
