---
id: ENGUI-625
title: Preserve secure upload filename delimiters for Qwen MaskFlow MCP editing
status: Done
created_date: '2026-11-28'
labels: [mcp, qwen, bug, secure-transport]
---

Owner15162 authorized repair after two Showdown jobs failed before inference.
S3Service normalizes repeated underscores in names, but the MaskFlow endpoint requires
job__attempt__input__role delimiters. Preserve safe underscores without weakening endpoint
job/attempt binding or changing endpoint images, quotas, model policy or UI.

## Acceptance
- Actual production uploader and real Python MaskFlow handler interoperate for encrypted source/mask/output.
- Reproduce the existing failure before the fix; preserve ordinary filename safety and collision handling.
- Run related transport/MCP regression checks and isolated production build.
- Deploy Engui only with previous build retained, verify live MCP availability, commit and push.
- Do not replay failed user jobs.

## Delivered
- Feature commit120b97c preserves safe repeated underscores in the production S3 uploader. Endpoint binding checks and ordinary unsafe-character sanitization are unchanged; collision handling remains covered.
- Strengthened MCP test now uses the actual S3 uploader (only AWS I/O is mocked) and the real Python MaskFlow handler, including encrypted inputs/output. The pre-fix test reproduced the exact production exception; the fixed test passed.
-61 related tests passed across4files: MaskFlow, regional Krea2, secure submission and S3 upload/download. Existing test harness needed the Krea worker fixture environment; final run is green.
- Isolated production build46NB263RkXiVjoF_lkSDp deployed after zero active jobs/dispatch/uploads/activities were confirmed. Previous buildco7ieM-tA-Al8cucYw_Ul retained at /home/engui/engui-runs/engui-625-20261128/previous.next.
- Authenticated live MCP and mobileHTTP200 verified. MaskFlow/Krea enabled, Z-Image/ordinary Qwen disabled as requested. No endpoint/container/config change, no user-job replay or new paid generation.
- Evidence: /home/engui/engui-runs/engui-625-20261128 (red.log,checks2.log,build.log,deployment.json,live-check.json). First deployment attempt stopped at a Git owner check before service changes; rerun as repository owner succeeded.
