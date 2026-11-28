---
id: ENGUI-625
title: Preserve secure upload filename delimiters for Qwen MaskFlow MCP editing
status: In Progress
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
