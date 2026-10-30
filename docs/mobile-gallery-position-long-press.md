# Mobile gallery return-point long press (ENGUI-570)

Keep the existing single Save/Clear/Return icon. In Return state, primary pointer down starts a 600ms hold; completing it clears the offscreen saved position without scrolling. Release/click after a completed hold must be consumed so the newly neutral button does not save another point. A subsequent independent tap works normally. Keyboard Enter/Space keep the short action.

Cancel a hold on movement over 10px, pointer cancellation/leave, disabled/state/workspace changes and unmount. Do not disable page scrolling or alter viewport behavior. Suppress the native callout only on this button. Recheck item visibility before clearing. Keep the same accessible action labels and add an English hold-to-clear description in Return state.

Extract the existing position button to a small mobile component to contain pointer handling; expose a guarded clear-away operation from the existing position hook. Test short/long taps, trailing click, canceled gestures, fresh visibility, workspace isolation and storage persistence. Use fixture browsers without generation calls. Build in isolation, retain previous.next for rollback, deploy and commit/push as owner.

## Implementation

MobileGalleryPositionButton contains the bounded pointer hold; no global pointer handlers, body locks or scroll changes. A ref consumes the trailing click across the Return-to-Save state change. The existing gallery position hook re-measures actual tile visibility immediately before clear. The same button retains normal Save/Clear/Return and keyboard actions.

58 targeted tests pass, including storage/restore, 9 hold/cancellation cases and the previously shipped paste and iPhone height scenarios. Isolated production build passed. Existing nested-button warning in gallery fixture output predates this change; no unrelated gallery tile markup was changed.


## Deployment

Service restarted 2026-10-30 11:29:44 UTC. Public mobile gallery and prompt routes return HTTP200. Prior paste-enabled build is retained at /home/engui/engui-runs/engui-570-20261030/previous.next. Preview exited 0. Isolated preview passes 27 scenarios each in WebKit and Chromium, including native touch hold in Chromium, release-click suppression, unchanged scroll position, reload persistence, ordinary short tap and pointer movement cancellation. Paste and standalone-height regressions are included.

Deployed HTTPS WebKit and Chromium checks also pass 27 scenarios each, zero JavaScript page errors, unexpected API paths or production API writes.
