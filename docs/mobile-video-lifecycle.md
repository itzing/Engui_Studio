# Mobile video resource lifecycle

## Scope and diagnosis

Mobile Jobs/Gallery fullscreen, native details/preview players and the mobile carousel. Source detachment is missing or timing-dependent on several navigation paths. The reported native YouTube failure requires physical-device validation; missing explicit teardown alone does not prove a hardware-decoder leak.

## Approach

Use an owned mobile video component with a stable DOM ref and an idempotent lifecycle controller. It must dispose synchronously on ref detachment, own source assignment, and ignore stale playback attempts. Suspend on visibilitychange/pagehide, capture time and playback intent once, detach the source, then restore on pageshow/visibility return. Preserve a user's paused state. Route programmatic playback through the controller where the shared players initiate it.

Do not release resources from an inline parent ref merely because React re-renders controls. Keep inactive fullscreen/TikTok slides as posters. Gate carousel automatic retries while backgrounded. Desktop players keep existing rendering and playback behavior; intentional multi-video carousel modes retain their layout and playback count while visible.

## Verification

Test teardown, source changes, repeated renders, background/foreground, pending play promises and event ordering. Run existing fullscreen/carousel/details regressions. Repeat the synthetic real-browser diagnosis on the candidate and deployed build, ensuring no source remains on removed managed video elements and no API writes/generation jobs occur. Chromium checks actual fixture decoding; Linux WebKit checks lifecycle and UI only, not iOS hardware behavior.

## Deployment and rollback

Build in isolated staging with ENGUI_ISOLATED_VALIDATION=1. Retain the previous serving .next, switch the verified build and explicitly restart engui-studio.service. Revert the feature commit and restore the retained build if needed. No schema, model or provider changes.

## Delivered behavior

`ManagedVideo` owns source assignment independently from React prop/ref churn. Its stable ref disposes the media before notifying parent removal. The lifecycle controller keeps an idempotent disposed state in a WeakMap, so delayed playback callers cannot restart a removed player. It handles both visibilitychange and pagehide/pageshow, avoids duplicate suspension, restores saved time, and resumes only the previous playback intent. Autoplay rejection remains retryable by a user gesture; no automatic rejection loop was added.

The mobile wrappers opt into managed fullscreen/carousel rendering, including tablet surfaces. Inactive mobile fullscreen and TikTok slides remain poster-only. Intentional multi-video layouts retain their visible behavior; all their sources are released while backgrounded. Carousel retry timers, Flow queue timers and movement stop in the background.

## Validation result

- 67 focused tests pass, including nine new ownership/lifecycle regressions.
- Isolated production build and source hash verification pass.
- Each browser (Chromium/WebKit), in each environment (preview/production), passes 12 lifecycle cases, one foreground/manual-pause check, and 11 Info/swipe regressions. All API traffic is synthetic/intercepted; no generation jobs or write requests.
- Chromium decoded the H.264 fixture. Linux WebKit tested DOM lifecycle/UI only; no physical-iPhone decoder validation is claimed.
- TypeScript review corrected new ManagedVideo source typing; the pre-existing ZoomRef declaration error and unrelated global debt remain.
- The initial repeated-open fixture omitted Jobs API focus metadata and produced inconsistent saved selection. Correcting the fixture restored the actual server contract; production Jobs selection logic was not changed.
- The serving build is cXIKN94cTIiR1fbDYit9Z. The previous build is retained under `/home/engui/engui-runs/engui-578-20261108/previous.next`.

This removes confirmed application resource-lifecycle gaps. Whether it prevents the owner's whole-device iOS/YouTube freeze remains a physical-device acceptance check.
