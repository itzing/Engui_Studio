# Mobile gallery hold confirmation

## Approved scope

Replace the ineffective iPhone haptic workaround with a small non-interactive **Position cleared** badge above the existing single mobile gallery position button. The owner approved this fallback after reporting no tactile response on iOS 26.6.2. No desktop changes.

## Behavior

Only show confirmation after a successful guarded 600ms offscreen clear. Display immediately while the pointer is still held, retain it after release, and dismiss after 1.6 seconds. A new activation or workspace change dismisses old feedback; unmount clears timers. Keep short tap return, visibility guard and consumed release click unchanged.

Use an absolutely positioned opaque badge above the button with pointer-events disabled, an accessible live status and no focusable controls. Do not move the toolbar, change viewport sizing or add sound. Remove the now-unused haptic helper and tests. Existing persisted gallery points and prompt-paste behavior remain unchanged.

## Validation and rollback

Check before-release appearance, placement at 320/390px, pointer pass-through, timed disappearance and cancellation/workspace behavior. Run focused tests and isolated production build, then WebKit/Chromium fixture checks in preview and on the production URL. Fixtures must block production API writes and generation jobs. Retain the previous .next build for rollback and revert the scoped commit if required.

## Validation results

61 targeted tests and isolated build passed. WebKit/Chromium: 30 checks per engine in preview and production, including visible-before-release placement at 320/390px, no release resave, unchanged scrolling, automatic dismissal and existing clipboard/viewport checks. Screenshots were inspected. No JavaScript errors or API writes. Deployment: 2026-10-30 11:49:15 UTC. Native iPhone validation remains distinct from browser fixture evidence.
