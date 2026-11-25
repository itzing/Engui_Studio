# ENGUI-611 — MCP image upload and complete Z-Image i2i workflow

## Status
In progress.

## Authorization and scope
Owner14877 requests local file upload for an agent to use as Z-Image i2i input, after ENGUI-610. MCP only; no UI or endpoint changes. Verify discoverable inputs, parameters, preparation, immutable source checks and encrypted dispatch. No paid inference needed.

## Approach
Create a workspace/credential-scoped, short-lived upload capability from declared filename, MIME, byte length and SHA-256. Upload raw bytes over bounded HTTP PUT (not base64 in tool context). Validate static PNG/JPEG/WebP,25MiB/40MP, hash and actual decoded type. Save exact original as an imported Draft Gallery asset with reusable media source. Idempotent retries and a get-upload tool recover uncertain delivery; expired links can be renewed with the same request key. Reuse existing reference/preview/download/plan paths. No arbitrary URL fetching or server/client file paths. No inference on upload.

## Verification
Isolated MCP-client integration tests for actual uploads, auth/revocation/workspace isolation, retry/concurrency/expiry, malformed/oversized media, deletion, exact-original download and upload→prepare→start→encrypted Z-Image i2i dispatch with provider/storage mocks. Public ingress bounded-upload tests, MCP regression suite, production build and isolated/public HTTP checks. Preserve current build/proxy and existing submitted provider Job IDs during rollout.

## Candidate verification
-33 upload/i2i integration tests passed, including byte-exact PNG/JPEG/WebP import, read/generate scopes, workspace/credential binding, expiry/revocation, idempotent/concurrent PUTs, lost-response recovery, malformed/oversized images, deleted/changed source rejection, and real production encrypted Z-Image dispatch with storage/provider mocks (init_image, prompt/negative prompt, LoRA, denoise, seed, no duplicate start).
-173 MCP regression tests passed across6files;12 public-proxy checks passed. Existing discovery assertions updated from27→29 total tools and16→17 read tools.
-Production build passed;0 new TypeScript diagnostics against baseline.21 candidate HTTP checks through streaming ingress passed with788425-byte synthetic PNG (larger than JSON cap), exact-original download and an immutable Z-Image i2i plan. No provider inference performed.
-Initial test fixtures corrected: explicit workspace count filters, supported512px output minimum, fixture LoRA storage fingerprint, and required isolated database naming. No production changes made for these fixture errors.
-Evidence: /home/engui/engui-runs/engui-611-20261125. Rollout includes application and exact PUT proxy allowlist; previous files retained. No UI, endpoints, quotas or database schema changes.
