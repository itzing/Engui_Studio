# Mobile queue notifications

## Approved scope
Owner14606 approved in-app mobile notifications after explicitly excluding system notifications and a server summary (the queue has at most 50 jobs). Reuse StudioContext's existing jobs list and polling; no new API, poller, worker queries, push permissions, service worker changes or desktop notification UI.

## Behavior
- A busy cycle starts when active jobs appear and ends after all tracked jobs are terminal for 2.5 seconds. New active jobs join the same cycle.
- Show at most one Queue started banner on the first observed processing transition, then one Queue finished outcome. Subsequent worker starts/restarts do not notify.
- Initial history is silent. An initially running queue is adopted without a retrospective start. Reload resumes a known cycle using tab/workspace-scoped sessionStorage.
- finalizing is active. Missing active jobs count as removed, not completed; cancelled failures are counted separately. Preserve known terminal outcomes when Clear finished removes records.
- A single top banner, below safe-area inset, above app/fullscreen overlays. Seven-second timeout, Close and View jobs actions, polite live region, no autofocus/audio/vibration. Completion replaces start rather than stacking.
- Keep a small unread outcome dot on Jobs until a Jobs route is visited. Do not mark unread while already in Jobs.
- Do not consume notices while hidden/offline. On foreground/reconnect wait for the existing status poll to reconcile active jobs before showing a pending start; if already finished, only show the final outcome.
- A failed/unfinished initial load and workspace reset are not an empty queue. Workspace lifecycles and dedupe are isolated.

## Implementation
Pure queue-state reducer + one provider/observer in MobileAppProviders. Add frontend-only jobs readiness and successful poll revision metadata to StudioContext; do not change request cadence/endpoints. Portal the banner outside screen stacking contexts. Bottom navigation reads only the optional unread flag.

## Validation and rollback
Unit tests cover lifecycle, aggregation, errors/cancel/removal, debounce, historical baseline and storage. Rendered integration tests cover navigation, hidden/offline/resume, reload/workspace switches, display actions and unread state. Intercept all browser API requests for Chromium/WebKit checks of mobile routes, fullscreen layering, narrow widths and desktop exclusion; no real jobs.
Build in isolated staging with ENGUI_ISOLATED_VALIDATION=1. Commit/push as owner, preserve previous.next, promote candidate and restart engui-studio.service. Rollback restores previous.next and reverts feature commit; no database changes.
