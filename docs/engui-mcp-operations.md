# Engui MCP operations

## Scope

Implementation: ENGUI-582 through ENGUI-586. The owner explicitly excluded connecting OpenClaw or another agent. No client configuration, persistent client connection or paid generation is part of deployment. The SDK test client is used only with isolated fixtures and a mocked provider.

The server implements 15 workspace-bound concept-generation tools at `POST /api/mcp`. It is stateless Streamable HTTP using pinned `@modelcontextprotocol/sdk` 1.32.2. MCP sessions are not a workspace-selection mechanism. GET/DELETE are unsupported. This is a backend change, with no desktop/mobile UI additions.

## Admission and credentials

- `ENGUI_MCP_ENABLED=1` admits requests and queued dispatch; absent/other values return 404 and prevent new dispatch. The worker still settles already accepted work and preserves originals.
- `ENGUI_MCP_ALLOWED_HOSTS`: comma-separated non-loopback host values, including port when present. Literal loopback is permitted. Configure the trusted TLS reverse proxy before remote access; no wildcard CORS is enabled.
- `ENGUI_MCP_ALLOWED_ORIGINS`: optional exact allowed browser origins. Native clients may omit Origin. No client is configured automatically.
- Every request requires `Authorization: Bearer <token>` and `X-Workspace-Id: <UUID>`. Cookies, tool arguments and query selectors cannot select scope. Tokens belong to exactly one workspace.
- Token generation uses 256 random bits and stores only a SHA-256 hash. Each token includes `read`; `generate`, `curate`, `cancel` are explicit. No production token is created during this delivery.

Run the CLI locally as the Engui service user, from the repository root:

```sh
npx tsx scripts/mcp/credentials.ts list <workspace-uuid>
npx tsx scripts/mcp/credentials.ts create <workspace-uuid> read,generate,curate,cancel 30 /private/path/token
npx tsx scripts/mcp/credentials.ts revoke <workspace-uuid> <public-token-id>
```

The optional new output file is created with mode 0600 and must not exist beforehand. Without it, create writes the token to stdout exactly once; use only an explicitly requested provisioning session, not general logs. Store a future client header using that client's secret-reference mechanism. Never commit a token. Revocation stops undispatched work but does not erase images or cancel accepted provider jobs.

## Durable generation behavior

1. Prepare validates the model/mode, current character and look, visible LoRAs, Vibe/wildcards and reference bytes. It persists exact seeds and fully resolved prompts; it performs no provider/helper inference or uploads.
2. Start atomically creates one batch per plan and fixed job IDs. Repeated request keys with identical normalized inputs return the original receipt. Different payloads conflict. A new key cannot start the same plan twice.
3. A database-backed worker leases one dispatch at a time per workspace. It checks authority and plan dependencies, then calls the shared Engui submission service through an internal frozen-prompt adapter. Public REST requests cannot select this adapter.
4. MCP RunPod submission makes one HTTP attempt. Confirmed 400/401/403/404/422/429 rejections are terminal; timeouts, missing acknowledgements and crashes after the durable provider boundary become `submission_unknown`. That state blocks remaining variants in the batch and never automatically resubmits.
5. Recorded provider acceptance is reconciled through the existing Job supervisor. Cancellation fences queued work and requests cancellation without claiming completion. A completion/cancellation race preserves the actual completed image.
6. Completed originals are copied unchanged to Draft using an atomic source/bucket membership key. Saving to Common does not remove Draft. Archival failure retries local preservation only. Automatic enrichment/helper inference is not run for MCP saves.
7. Reviews preserve history. `approved` is a client action requiring the owner's actual choice in the conversation; a token cannot independently prove that consent. Optimistic revisions prevent silent replacement. Character edits mark a reference stale; trash/deletion makes the source unavailable.

The bounded adapters are Krea2 text-to-image, Z-Image text/image-to-image and Qwen one/two-reference edits. Pose conditioning, animation, sprite sheets and arbitrary URL import are not advertised. Image reads inspect static local PNG/JPEG/WebP originals referenced by owned gallery/job records; remote-only originals return `MEDIA_UNAVAILABLE` and are never fetched through an arbitrary URL. The production supervisor normally materializes originals locally. Preview output is WebP, at most 1024 px and 1 MiB; originals are untouched. Legacy static media exposure is unchanged.

## Limits and retention

Defaults: three variants, two active batches per workspace, one dispatch lane per workspace, two references, 25 MiB/source, 40 million decoded pixels, 128 KiB/request, 20/default and 50/max list page size. Preparation/start share 10 calls/minute/credential; other tools allow 120/minute. Effective limits are returned by get_context. Optional bounded overrides: `ENGUI_MCP_MAX_BATCHES`, `ENGUI_MCP_PREPARE_PER_MINUTE`, `ENGUI_MCP_CALLS_PER_MINUTE`.

Plans expire after 24 hours if not started. Durable operation receipts are not automatically pruned. An explicitly retired receipt remains a tombstone and cannot create new work. Short-lived rate-limit counters are pruned by the worker. General audit logs contain public identifiers/status/duration, not prompts, secrets or image bytes; scoped plans hold canonical provenance. Prisma automatic query-error logging is disabled to avoid echoing persisted input snapshots.

## Migration and deployment

```sh
python3 scripts/mcp/migrate.py --database /absolute/path/database.db --backup /private/path/pre-mcp.db
npm run db:generate
npm run build
sudo -n systemctl restart engui-studio.service
systemctl status engui-studio.service --no-pager
```

First rehearse on a consistent SQLite copy. The migration is additive and checksum-tracked; rerunning it is a no-op. Existing gallery duplicates are retained with their media: only the oldest active source/bucket membership receives the canonical unique key, and other legacy rows retain NULL keys. No original is deleted or relocated. Application save uses the same unique membership boundary thereafter.

All new content entities join workspace guards/deletion inventory. Composite plan/batch relationships enforce matching workspace IDs. Review source identifiers deliberately survive deletion of the source so a missing reference remains reportable. Workspace deletion revokes credentials and fences queued variants; unresolved provider acceptance blocks final deletion until reconciled. Shared Default LoRAs remain untouched.

Build and test staging must set `ENGUI_ISOLATED_VALIDATION=1`. No paid provider validation is allowed without an explicit owner instruction. Keep the previous serving build and the pre-migration backup. Source changes do not configure an OpenClaw MCP connection.

## Rollback and uncertain acceptance

Disable admission (`ENGUI_MCP_ENABLED=0`) and revoke relevant credentials to stop new dispatch. Keep the existing supervisor running for accepted jobs. Inspect unknown variants and local Job/provider receipts before stopping the worker or restoring an older build. A recorded remote ID is evidence for reconciliation; absence of one is not proof that the provider did not accept the request. Never turn an unknown variant back into a queued generation.

If no work has been submitted, restoring the prior build is safe after disabling admission. Leave the additive schema in place. Once paid work exists, do not restore an old database over accepted jobs and do not drop receipt/variant tables. Rollback never deletes generated originals.

## Delivered validation and deployment state (2026-11-11)

- 68 focused tests passed, including 27 database-backed MCP integration scenarios and existing image/Gallery/RunPod regressions.
- Built Next.js HTTP endpoint passed official SDK initialization/discovery, context/model reads, actual image content, wrong-workspace rejection and token revocation using a copied database and synthetic media. The fixture credential was revoked and the temporary server stopped.
- Migration rehearsal preserved all 51 existing table counts and all 10,170 original gallery identifiers/hashes/URLs; repeated migration was a no-op and SQLite integrity was valid.
- Final production build passed. Production service is active; /, /m/create and /m/gallery return 200, unauthenticated /api/mcp returns 401.
- Admission is enabled via /etc/systemd/system/engui-studio.service.d/90-mcp.conf. Non-loopback hosts remain unconfigured until a future connection request. Production MCP credential and batch counts are both zero.
- No OpenClaw/agent connection was configured and no paid generation, helper inference or Studio Session run was launched.
- Repository-wide TypeScript checking still reports pre-existing unrelated errors; the new MCP modules, shared gallery service and changed provider path have no remaining focused diagnostics. The production build follows the existing repository configuration.
- Previous build: /home/engui/engui-runs/engui-mcp-20261111/previous.next. Consistent database backup: production-before-mcp.db in the same private run directory. Do not restore that database over any subsequently accepted work.
