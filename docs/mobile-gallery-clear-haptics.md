# Mobile gallery clear haptics

## Scope and design

Mobile gallery only. Request one pulse synchronously after a successful 600ms hold clears the offscreen return point, not on release. Return a boolean from the guarded clear action so rejected clears cannot produce success feedback. Preserve the single existing Save/Clear/Return control and all gesture cancellation behavior.

Use a small dependency-free, best-effort helper. Prefer a 15ms Vibration API pulse where supported. For Safari with native switch support, activate a temporary hidden label-associated checkbox switch. Keep it out of focus and accessibility navigation and remove it immediately. Catch unavailable/denied API errors. No sound, user settings, global listeners, viewport changes or additional visible controls.

## Evidence and limits

- https://github.com/lochie/web-haptics (reviewed published 0.0.6): uses a hidden native switch and label click for iOS.
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/CheckboxInputType.cpp: native switch haptics are gated by user-gesture processing.
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/DOMTimer.cpp: forwards the originating gesture into eligible one-shot timer callbacks. The existing hold is 600ms, inside the one-second forwarding window documented in Source/WebCore/dom/UserGestureIndicator.h.

This is progressive enhancement, not a guaranteed iOS vibration API. OS haptic settings and browser gesture rules may suppress the physical response. Automated tests can verify timing, DOM cleanup and non-interference but cannot assert an actual iPhone vibration. Owner-side confirmation is required.

## Validation and rollback

Verify one request at successful clear, no requests on guarded/cancelled/short paths, native switch cleanup, unchanged focus and storage/release semantics. Run the focused mobile tests and isolated build, then WebKit/Chromium preview and deployed checks. Do not run generation jobs. Preserve the running production build while compiling; retain it for rollback and revert the commit if needed.

## Verification notes

62 targeted tests pass. Preview checks pass in Chromium and WebKit (28 scenarios each). Linux WebKit does not expose Apple-platform switch capability, so the browser fixture explicitly supplies that capability flag while testing real label activation, timing, focus and cleanup. Chromium spies on the Vibration API. Neither fixture proves a physical pulse. The first unadapted Linux run is retained under runs/engui-gallery-haptics-20261030/preview; corrected platform-aware preview evidence is under preview-verified. There were no production API writes or generation jobs.

Production verification also passed 28 scenarios per engine after deployment at 11:38:43 UTC. The actual iPhone pulse remains unverified until owner feedback.
