# Mobile Gallery / Jobs playback recovery (ENGUI-599)

## Behavior
The shared mobile fullscreen viewer retains its persistent owned player. `RecoverableVideo` adds an explicit Retry after media error, current-source play rejection, or 10 seconds without playback progress. It never retries automatically. A tap on Retry synchronously resets the current source using the existing owner, not a new element or route navigation. Native desktop players and TikTok UI are unchanged.

The observer respects manual pause, visibility/pagehide suspension, foreground resume, source replacement, image slides, and synchronous unmount cleanup. A stale play promise rejection cannot mark a newly selected source as failed. A never-settling promise can be superseded by an explicit Retry.

## iPhone diagnostics
The failure overlay has **Copy diagnostics**. Clipboard failures expose a read-only selectable text field. Export is local and explicit, with at most 160 events; no server upload, media URLs, asset/workspace/job IDs, prompts or exception messages. Events include mute/inline/control flags, readiness/network/error codes, visibility, safe browser rejection names and available Audio Session state. The code observes the optional Audio Session API; it does not change its policy or claim to manage another app's playback.

## Evidence and limitations
Showdown's two active files decode correctly and contain no audio tracks. Native HTTPS range delivery is correct. There are currently no video jobs in that workspace, so Jobs browser checks use read-only intercepted completed-job fixtures referencing the real Showdown media; no generation jobs or writes are submitted.

72 targeted tests passed: 32 media/recovery checks plus 40 existing fullscreen/carousel regressions. Candidate Chromium passed 26 workflow assertions including actual H264 playback, error-to-Retry, same-element recovery, 10-second hung-native-load timeout, manual pause, background/foreground, Jobs, route roundtrip, diagnostics clipboard and fallback. Linux WebKit passed 10 UI/lifecycle assertions; its H264 decoder is unavailable, so that is not an iPhone playback test. Both browsers report no page exceptions and no attempted server writes.

The original iPhone PWA report also describes background YouTube pausing and recovery only after changing tabs. That complete scenario has NOT been reproduced on a physical iPhone. This patch fixes confirmed recovery gaps and adds on-device diagnostic access; it is not proof that iOS audio interruption is resolved.

Full repository TypeScript still reports existing errors, including the unchanged ZoomRef import; no new diagnostic in the recovery/diagnostics/lifecycle additions. The isolated production build passes under the existing build configuration.

## Release / rollback
Frontend-only; no database migration, model/provider changes or media rewriting. Build candidate in an isolated staging directory with background services disabled, validate, commit/push under the repository owner's identity, preserve the currently serving `.next`, promote candidate and restart `engui-studio.service`. Roll back by restoring the retained build and restarting, then revert the feature commit if needed. Logs and builds: `/home/engui/engui-runs/engui-599-20261122`; browser evidence: workspace `runs/engui-599-20261122`.
