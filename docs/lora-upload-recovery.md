# LoRA upload recovery

The shared LoRA manager had a pointer-events-none ancestor around its Cancel button. Its XHR part requests had neither inactivity nor response deadlines, so a hanging request never reached the existing retry loop. Cleanup also blocked UI cancellation.

## Chosen approach
Remove ancestor pointer suppression while separately guarding the file picker and drop handlers. Bound each part by 60 seconds without new upload bytes and 120 seconds waiting for server acknowledgment. Retry the same upload ID and part number, at most three attempts. Do not reset a healthy upload merely because total transfer duration is long.

Cancel takes effect locally immediately. Server multipart cleanup is bounded, deduplicated and separate from the local state transition. Upload ownership tokens prevent late continuations from updating a newer transfer. Cancel stops a multi-file selection. An initialization that resolves after cancellation is cleaned up using its returned binding. Pending server uploads refresh after cleanup and remain available if cleanup fails.

## Not included
No resume across page reloads, part-size changes, provider changes, published-LoRA deletion, or paid generation. Existing source files and completed LoRAs are untouched.

## Verification
- 18 focused tests pass: 13 cancellation/recovery scenarios, 3 existing manager UI scenarios, 2 upload-proof tests.
- Production build passes; application source hashes are checked before promotion. No new diagnostics in changed files. Full TypeScript check still reports pre-existing repository errors.
- Two legacy multipart API tests fail identically on the previous release and this candidate: their fixtures still expect the old unscoped upload API. These are not claimed passing and the API implementation was not changed.
- Browser fixture intercepts every multipart write and blocks unrelated writes. Real pointer/keyboard cancellation, delayed cleanup isolation, stalled-part retry and complete-only finalization are checked in Chromium and WebKit.
- No real fixture uploads, published LoRA changes or generation jobs are created. Only the owner's specifically identified unfinished upload was aborted through the existing guarded API.
- Build/rollback evidence: `/home/engui/engui-runs/engui-600-20261123`.
- Browser evidence: `/var/lib/openclaw/.openclaw/workspace/runs/engui-lora-upload-20261123`.


## Deployment
Feature c4f775c, production build mmNaSExIIdruz_nD0DWyd, 2026-11-23 14:21 UTC. Both direct HTTP and Tailscale HTTPS pass. Chromium11/WebKit11 pass on both candidate and installed build with no page exceptions. Prior build c75JRcdCDsomyd2PrTFK0 retained; `rollback.py` restores it before a service restart.
