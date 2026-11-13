# Video Random Seed restoration

## Diagnosis and approach

Gallery video reuse returns the stored video randomizeSeed in its options. The shared video draft writer copies those options into parameterValues but, unlike the image and text-to-video branches, omits the top-level randomizeSeed field consumed by VideoGenerationForm. This restores the checkbox as false on every full img2vid reuse.

Restore the normalized flag in that shared full-video branch. Do not change the image-only handoff that intentionally preserves the current video draft. Confirm that source-image Randomize does not overwrite the video's own preference. Existing Gallery metadata does not need rewriting when its video flag is already present.

## Validation plan

Reproduce before fixing with a regression test. Check job submission metadata and Gallery save/reuse for true/false and actual seed without an available source job. Exercise Gallery details and video-carousel reuse on desktop/mobile in Chromium/WebKit, including opposite existing drafts. Use intercepted browser requests and fake providers only. Build in isolation, retain the previous build, deploy and verify.

## Verified before deployment

The eight new draft assertions fail on the original code and pass with the one-line fix. The old production UI reproduces the disabled checkbox in Chromium and WebKit. Backend submission, Gallery save/reuse, shared draft and carousel coverage: 95 passing tests. Existing video form fixtures were updated for workspace scoping and current fetch contracts: all 32 tests pass.

The isolated production build passes. Preview browser evidence includes 36 passing checks across Chromium/WebKit: true/false restoration via phone/tablet Gallery details, desktop Gallery dialog with an already-mounted form, direct phone TikTok reuse and TikTok Info/details; image-only handoff preserving the current video draft; and phone/desktop video submission. API calls are intercepted, with unknown writes blocked. No physical iPhone or paid-provider execution is claimed.

A read-only sample of 200 recent saved videos contains 192 true and eight false video flags, with none missing. Existing saved videos with a valid flag benefit from corrected reuse without metadata changes.

## Deployed result

Code commit `1d2ffc5` was pushed under the owner identity and deployed on 2026-11-13 at 20:49 UTC. Service and HTTP health checks pass. All 36 production browser checks pass in Chromium/WebKit, matching the 36 preview checks (72 total). WebKit logged one aborted-navigation request message during the run; all UI and seed assertions passed. The previous production build remains available for rollback.
