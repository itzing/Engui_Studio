# Mobile keyboard dismissal recovery

## Context and decision

The owner confirmed rollback d7c1630 restores iPhone availability, but still needs the original post-keyboard bottom-panel gap fixed. ENGUI-567 follows ENGUI-565/566.

Two approaches were considered:

1. Lock the root and resize/reposition the shell using visualViewport. Rejected: this changes keyboard focus/scroll/layout semantics and was the scope of the failed 0f445de deployment.
2. Keep the known-working shell and reset only a residual document pan after keyboard dismissal. Selected: the change is bounded and does not own layout, inner scrolling, or navigation.

The previous controller's isolated native timer/focus/resize/cleanup probe passes in Linux WebKit 26 and Chromium. This does not identify the original iPhone exception; no device stack trace is available. Do not present the original crash as diagnosed.

## Behavior

- Preserve existing CSS, shell height, nav, safe areas and screen scroll containers.
- Observe keyboard-size reductions relative to the full layout viewport. Avoid recovery while the keyboard still occupies the viewport or pinch zoom is active.
- After focus changes, actual viewport size changes, navigation or page restoration, try document-only scroll recovery at 0/120/350/700 ms.
- Handle dismissal while the editor retains focus once a keyboard-size reduction has been observed.
- Keep geometry state across mobile routes, including removal of a focused editor without focusout.
- Never subscribe to document/visualViewport scroll events; ignore same-size resize events to avoid a correction loop.
- Do not blur inputs, modify root styles, scroll nested containers, or run persistent timers.
- Remove all listeners/timers on mobile exit.

## Validation and rollout

Run meaningful dismissal/animation/zoom/navigation/cleanup tests plus existing gallery/form-factor/RunPod tests. Exercise native APIs and synthetic root drift in WebKit and Chromium, then fixture-backed mobile entry/prompt/Jobs/Gallery/Carousel navigation in both engines. Linux WebKit is not a physical iPhone keyboard test.

Use an isolated temporary build directory and ENGUI_ISOLATED_VALIDATION=1 for any preview; do not overwrite the running production build during investigation. No generation jobs or production API writes. Build and deploy after checks pass; commit/push under owner identity. Owner should confirm the final native dismissal behavior.

## Rollback

Revert the ENGUI-567 commit, rebuild, and restart engui-studio.service. d7c1630 is the owner-confirmed mobile baseline. No database or endpoint changes.

## Validation result — 2026-10-28

- 51/51 focused tests; targeted recovery-module TypeScript check passed.
- WebKit 26 and Chromium: six recovery probes each (baseline document gap, open-keyboard guard, dismissal/inner scroll, dismissal without blur, late geometry, disposal). Keyboard height is synthetic; scrolling, timers, focus and event bindings are native.
- 13 full-app checks per engine passed on both isolated preview and deployed HTTPS. Zero final client exceptions, API writes and unexpected API paths. No visualViewport mock is used in the full-app checks.
- Production build exited 0 from an isolated source snapshot with cached compilation. Candidate source bytes were checked against the live repo before installing its build. The previous production build is retained for rapid rollback.
- Service restarted 22:41:53 UTC; 10 HTTP checks passed. Preview stopped with exit 0.

The first isolated WebKit recovery fixture put the editor above the viewport, triggering the browser's own asynchronous focus scrolling. Keeping the editor visible separated that behavior from the dismissal-recovery assertion; no production workaround was added for the test. Initial probe evidence is retained.

Physical iPhone keyboard confirmation remains owner-side. The exact original 0f445de exception is not proven by the current WebKit probe, and the old controller has not been restored.
