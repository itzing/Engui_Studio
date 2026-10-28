# Mobile keyboard viewport recovery

## Diagnosis

The mobile shell uses normal-flow 100dvh sizing, while body.engui-mobile-shell explicitly re-enables root overscroll. iOS can pan the document while focusing an input and leave a residual document/visual-viewport offset after keyboard dismissal. The supplied screenshot is consistent with this path; a physical iPhone keyboard reproduction is not available on the server.

## Implementation

Use the persistent /m provider to own mobile-only root scroll locking and visual viewport listeners. Bind a fixed mobile shell (including orientation gates) to the visual viewport height/offset, with a dynamic viewport CSS fallback. Coalesce updates with animation frames; resample after focus changes to cover delayed iOS keyboard animations. Reset only residual document scroll when the keyboard is no longer occupying the viewport; do not blur controls or reset nested scrolling. Keep safe-area padding and bottom-navigation flex sizing. Clean up all state on leaving /m. Do not alter desktop styles or unrelated generation behavior.

## Validation

Exercise mocked visualViewport resize/scroll and keyboard focus/dismissal in component tests. Use read-only Playwright fixtures to compare old/new root-scroll behavior, assert bottom alignment and preservation of inner scroll, and cover phone/tablet/desktop navigation. Emulation does not prove physical iOS keyboard behavior; record that limitation. Build production, restart Engui and verify deployed mobile routes without submitting jobs.

## Rollback

Revert the feature commit, rebuild production and restart engui-studio.service. No storage or database changes.

## Verification outcome

On 2026-10-28, 34 focused tests and the targeted viewport-module type check passed. The final production build passed. Eleven Chromium scenarios passed both on the isolated preview and after deployment, covering a synthetic old-layout root-scroll gap, visual viewport changes, dismissal with and without blur/resize, inner gallery scroll retention, Jobs navigation, 320px width, phone/tablet orientation gates, and desktop document behavior. No final browser run produced page errors or API writes. This does not substitute for a physical iOS keyboard test.

Use ENGUI_ISOLATED_VALIDATION=1 for temporary Next.js preview servers so they do not start the production RunPod supervisor. Browser tests intercept API requests and provide existing workspace/project fixtures; all writes are blocked. The production Next.js configuration skips full-repository type/lint checks; only the new viewport module received a targeted TypeScript pass.
