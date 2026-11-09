# Bounded mobile video byte cache

## Scope and decision

Owner14266 approves mobile-only improvements to ENGUI-579. Do not remux, transcode, rewrite or regenerate any media. Keep one ManagedVideo per single-video surface. Cache compressed files, not extra decoder elements. Desktop and ordinary multi-video carousel stay unchanged.

## Design

Use a viewer-lifetime byte cache (up to5 entries/24MiB, individual files at most8MiB) with one sequential background fetch and an active Blob lease. Start background work only after current playback has a usable buffer and a short settled interval; prioritize next, current/recent and previous files. Cancel obsolete requests and suspend downloads on waiting/stall or background. Stream responses with size limits; keep active leases pinned and revoke Blob URLs only after the owner has detached the source. Dispose all resources when the viewer closes/scope changes.

At source entry, use a completed cached Blob or the original URL. Never swap a native URL for a Blob when a background download finishes. Native playback starts immediately on cache miss; no full-file wait. If Blob playback fails, retry the original URL once on the same element. Fetch failures/unsupported sources must not disrupt playback. Same-origin media only; no persistent disk cache or uploads. Prefetch uses the browser HTTP cache where available, but full-file byte acquisition can still transfer extra data after native Range playback.

Delay the existing TikTok loading overlay250ms while retaining the poster; explicit Retry remains immediate. No new fullscreen controls.

## Verification

Cover bounded eviction, active URL pinning/lifetime, cancellation races, one fetch, cache hits/revisits, failure/oversize fallback, manual pause and source/background ownership. Browser probes intercept all media/APIs; no real jobs or writes. Check Blob playback in Chromium and lifecycle/UI in WebKit (Linux WebKit cannot decode the H.264 fixture). Physical iPhone remains required for stability/latency confirmation.

## Deployment

Isolated production build with ENGUI_ISOLATED_VALIDATION=1. Preserve current f6c3902 build for rollback, verify hashes and browser behavior, swap build and restart engui-studio.service explicitly. No database/provider/model/media changes.

## Verified result (2026-11-09)

80 targeted tests passed, including byte/item limits, active lease lifetime, serialized fetches, cancellation races, oversize/truncated/partial rejection, native miss streaming, cached revisits, error fallback and pause preservation. The same player is retained. Cache selection happens only at source entry; user-paused playback is not restarted by fallback or control rerenders. Viewer/workspace disposal releases cached data.

On the exact release candidate, Chromium completed40 warm TikTok and40 warm Jobs swipes with no new media requests and one video element. Blob frames decoded; warm loading overlays never became visible. The cold loading overlay appeared after its delay. Production repeated4 warm swipes per mode, plus mixed-media, ordinary-carousel, lifecycle and Info checks. Requests used synthetic fixtures and intercepted APIs, not real generation jobs. This is not a measured real-network/iPhone speed benchmark.

Linux WebKit cannot decode the H.264 fixture (native and Blob sources report error4). Its cache-specific check simulates buffered readiness to exercise one-time fallback to the native URL, lease release and absence of retry loops. Native lifecycle/UI/Info checks also pass, but real iPhone Blob playback and system-wide stability are not established.

Full tsc still reports existing repository errors, including the ZoomRef import and unrelated test typing. A newly found nullable scope prop was fixed; new cache/prefetch/controller/test files have no type diagnostics. Production build passed independently.

Running build TxHJAOnPzxjfWNVvnqWEL; previous A15oBS0Kn-cCav3ibRcgu retained in /home/engui/engui-runs/engui-580-20261109/previous.next. Source/test hashes match the release candidate. Service and routes healthy; previews stopped. Original media was never rewritten or repacked.
