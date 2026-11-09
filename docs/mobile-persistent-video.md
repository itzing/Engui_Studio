# Mobile persistent video and startup coordination

## Decision

Use one stable player per mobile single-video surface, not an unbounded sequence of keyed elements. Keep the existing managed owner and synchronous teardown. Do not replace the multi-video desktop/carousel product with a single-video mode.

## Implementation

- TikTok: mount the player outside keyed slots, move its presentation with its committed slot, switch source only after snap commit. Neighbors remain posters. Explicit Retry reloads the existing owner; automatic errors/stall timeout only expose Retry, never remount.
- Fullscreen: render one stable managed player in the lightbox controls layer, retain it unloaded/hidden during images, keep swipe gestures and existing UI actions. Native desktop slide players remain unchanged.
- Remove extra source-backed preload load after managed startup, and never pause a current player merely because readyState is zero.
- Add a bounded local in-memory event ring, persist only anomaly snapshots to sessionStorage, no network uploads/URLs/prompts. Include lifecycle, media states and counters, throttled playback progress; remove listeners/timers on disposal.

## Validation

Regression tests for source identity changes, rapid replacement with pending promises, startup pending state, repeated source switches, manual pause/background, mixed media, explicit Retry and privacy-bounded diagnostics. Intercept API/media in Chromium/WebKit; assert single stable element over many swipes, one play attempt per settled source, no source-backed load resets during normal startup, no jobs/writes. Browser validation does not establish iPhone hardware decoder recovery.

## Deployment and rollback

Isolated staging build with ENGUI_ISOLATED_VALIDATION=1, preserving production until build and checks pass. Retain serving .next, switch verified build and explicitly restart engui-studio.service. Revert this commit and restore previous build if necessary. No database/provider/model changes.

## Results (2026-11-09)

70 targeted tests and the isolated production build passed. Both Chromium and WebKit retained one player for 80 TikTok swipes and 80 Jobs swipes: 81 play requests including startup, with no source-backed load resets. Mixed-media Gallery retained its player while unloading it for images. Closing released the source. The ordinary multi-video carousel still had three players.

Preview and production passed 11 teardown cases, two foreground/swipe checks and 11 Info/navigation checks per engine. Production smoke checks also covered mixed-media navigation and ordinary carousel behavior. All browser API/media requests were intercepted; no generation jobs or application writes were issued. A WebKit-found overlay tap regression was fixed before final validation and deployment.

Full-repository TypeScript checking still reports existing errors, including the unchanged ZoomRef import and React mock typing; it is not reported as passing. Linux WebKit's fixture remains at readyState 0, so its results cover DOM/lifecycle/UI behavior, not hardware decoding. Chromium decoded the H.264 fixture at readyState 4. Neither validates the owner's iPhone-wide freeze resolution.

Deployed build: A15oBS0Kn-cCav3ibRcgu. Previous build: cXIKN94cTIiR1fbDYit9Z, retained at /home/engui/engui-runs/engui-579-20261109/previous.next. Detailed receipts: workspace runs/engui-persistent-video-20261109/ and /home/engui/engui-runs/engui-579-20261109/.

For local diagnosis, window.__enguiVideoDiagnostics() returns the last 160 events. Anomaly snapshots retain at most 80 events in sessionStorage under engui:video-diagnostics:v1. The records identify numeric player/source revisions, not media URLs or asset identifiers; they are not uploaded.
