---
id: ENGUI-616
title: Desktop central preview loading progress and stale-image isolation
status: Done
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

## Installed visual correction
Initial build passed behavior checks, but screenshot inspection found invalid generated alpha syntax: theme RGB variables contain commas while slash-opacity utilities compile to `rgb(var(--primary-rgb)/alpha)`. Corrected only the Desktop selected-row classes to `rgba(var(--primary-rgb),alpha)` (background/hover/outline); mobile theme unchanged. Added computed background and outline color assertions. The new check fails on the initial build as expected. Follow-up commit `25f4022`; feature `51bb2f0`.

## Delivered
- Commits: `51bb2f0` (loader and selection), `25f4022` (valid Desktop alpha colors), pushed to main.
- Installed build: `kd30Uz1NKx9LJ9GsJRqzw`; service active.
- Final corrected candidate and installed Desktop each pass 40 browser assertions (20 Chromium +20 WebKit), including computed background/outline colors. Initial 31 focused tests remain passing; no added TypeScript diagnostics.
- Download progress, immediate previous-image removal, request cancellation, Retry and current Job marker verified under delayed/unknown-length responses, rapid navigation, hover, Gallery return and selected Job deletion.
- All browser API writes blocked; no generation or production content changes. MCP policy, mobile UI and provider configuration unchanged.
- Restart guard confirmed zero active Jobs, MCP variants, uploads and workspace activities. Old Next.js did not finish graceful shutdown; after rechecking quiescence, terminated only the old service process to complete the requested restart.
- Corrected-build evidence: `/home/engui/engui-runs/engui-616-20261125-highlight`; browser evidence: workspace `runs/engui-616-20261125`.
- Pre-feature build `1DodNnbnRNU46RepbCQOM` retained in initial run `previous.next`; initial feature build `CMuszCAf_WpR3cwKSsreN` retained in corrected run `previous.next`. Isolated preview stopped after live proof.

## Build workflow lesson
Freeze uncommitted source changes before any slow baseline checks. The initial corrected candidate missed an already committed file because the build script enumerated modified files after the baseline check. Source/hash verification and actual-color assertions caught this; final candidate was rebuilt from the explicitly verified file. Stale completion files must not be treated as results of a still-running retry.
