# Workspace isolation specification

Status: agreed scope; documentation only. Implementation requires a separate user command.
Date: 2026-10-12
Surfaces: desktop and mobile
Companion: [Detailed implementation plan](workspace-isolation-implementation-plan.md)

## 1. Goal and authorization

Make workspaces reliable containers for user content while preserving the existing, long-used Default workspace. Switching must never silently reset, mix content, or make historical data disappear.

The current authorization covers this specification and its implementation plan only. No application, schema, production data, storage objects or services are to be changed. Before future implementation, create tickets in the repository's local backlog.

### Agreed product decisions

1. Desktop and mobile have the same workspace semantics.
2. Selection changes only through explicit user action and survives reloads.
3. Keys, application settings and connections remain global.
4. Other user content belongs to a workspace, except explicitly shared Default-owned LoRAs.
5. Existing content stays in the same Default. Previously unscoped content is assigned to it without changing IDs or file locations.
6. The existing Default is protected against deletion.
7. Deleting another workspace cancels its jobs and deletes its owned content/files. No transfer to Default.
8. S3 sync deletes genuinely missing LoRA records, with protection against treating errors as absence.
9. Selected LoRAs owned by Default can be shared with all current and future workspaces, without copying files or records.
10. Workspace/content transfer tools are out of scope.

The implementation details below are a proposed design, not a claim that these guarantees already exist.

## 2. Verified baseline and preservation guarantees

Read-only observations on 2026-10-12:

| Item | Observed state |
| --- | --- |
| Existing workspace | Default, ID `214653b8-0416-447a-bdfd-22e00785bedd` |
| Existing application user | `user-with-settings` |
| Database | `prisma/db/database.db`; quick_check passed; no foreign_key_check violations |
| Gallery | 8,761 assets: 8,709 active, 52 trashed |
| Original gallery files | All 8,761 referenced originals exist locally |
| LoRA library / helper profiles | 88 / 13; LoRAs currently under `/runpod-volume/loras` |
| Previously global characters / vibes / video projects | 71 / 3 / 163 |
| Video-create presets | 16; `Preset.userId` currently contains the Default workspace ID |
| Prompt documents / wildcards | 10 / 30 |
| Studio poses / video sequences | 165 / 12 |
| Retained jobs | 2; the gallery cannot be reconstructed from these jobs |

These are snapshot counts, not migration constants. Capture fresh manifests at rollout. File existence is not checksum or decoding verification.

Existing workspace columns point to this Default at the snapshot. Some list filtering works already; selection, browser content, unscoped roots, relationship validation, deletion and S3 handling remain incomplete.

### Invariants

- Preserve Default's ID, content IDs, timestamps, relationships, trash/favorites, LoRA metadata and existing URLs.
- Never create a replacement Default and repoint the old archive to a new ID.
- Never reconstruct the gallery from jobs or delete gallery assets merely because their originating job is gone.
- Never relocate existing root LoRAs or generation files just to add ownership.
- Backfill previously unscoped content to the verified original Default. Preserve valid existing owners. Ambiguous or contradictory ownership blocks migration.
- Existing LoRAs stay private until the user explicitly shares them.
- No paid generation or Studio Session runs for validation without separate approval.

## 3. Ownership contract

| Domain | Scope |
| --- | --- |
| API keys, accounts, endpoint/S3/helper connections and configuration | Global |
| Application preferences, such as theme/language | Global |
| Provider capabilities and bundled model catalogs | Global reference data |
| Provider/account balances and infrastructure telemetry | Global; not permission to expose another workspace's content-bearing job details |
| Jobs, attempts, outputs, generation history, materialization work | Workspace fixed at submission |
| Gallery assets, tags, favorites, trash, previews, thumbnails | Workspace; gallery survives job-retention cleanup |
| LoRAs and helper profiles | One owner; explicit shared Default LoRAs are the only library-sharing exception |
| Characters and versions | Character workspace inherited by versions |
| Vibes, pose presets, scenes and character bindings | Workspace; references must stay within it |
| Prompt documents, wildcards and other saved prompt material | Workspace |
| Video projects, tracks, keyframes, project audio, exports | Project workspace inherited through children |
| Video sequences and segment templates | Workspace |
| Create presets and user templates | Workspace, even when held in a general presets table |
| Studio templates, shots, revisions, versions, photo sessions, runs, portfolios | Workspace, including covers/previews/materialized outputs |
| Pose categories, poses, preview candidates, framing presets and pose-library settings | Workspace; content configuration, not global application settings |
| Browser drafts, attached media, reuse payloads, user voice samples/favorites | Workspace on the browser where stored |

Job-related usage/log entries carry the originating workspace where available. Account totals remain global; prompts, request bodies and job details follow content visibility. Deleting a workspace must not delete global connection settings or unrelated operational records.

The contract applies to lists, direct-ID reads, mutations, exports, reuse, selectors, submission, background writers and application-managed file actions. Hiding items in the UI is insufficient.

Children may inherit ownership instead of duplicating a column. If child and parent both have a workspace ID, they must agree. A relationship must not silently move a child.

### Server scope resolution

- Content operations resolve and validate the workspace and application user.
- Missing, invalid, foreign or deleting workspace IDs fail clearly, never silently falling back to Default.
- Client-provided object IDs and paths do not establish ownership.
- Cross-workspace direct-ID and mixed-scope bulk operations are rejected.
- Shared-LoRA references use a separate visibility check; no other cross-workspace content link is accepted.
- Settings/connection routes remain explicitly global.
- Legacy move/unassign-job APIs must not bypass the no-transfer rule.

This is organizational isolation within the existing application access model, not a new multi-tenant authentication system. Existing public/static media URLs do not become private just because their database records gain ownership.

## 4. Selection and navigation

### Persistence

- Reload restores the last explicitly selected, still-active workspace for that tab/browser.
- A new browser without a choice may initialize to protected Default.
- A saved ID that is missing or deleting leads to an explicit selection/unavailable screen, not an invisible fallback.
- Loading failures preserve the intended choice and show an error. An empty/error response must not create a new Default.
- Creating a workspace does not implicitly change an existing selection. An explicit `Create and switch` action can combine the operations.
- Rename, refresh, polling, job completion and settings changes never switch workspaces.
- Each tab keeps its selection; another tab/device cannot silently replace it. Persist tab choice for reload, with the browser's last explicit choice as the initial choice for a new tab.
- If the active workspace is deleted, the user explicitly chooses a successor during deletion or afterward.

### Async behavior

Submission, uploads, helper requests, reuse and background work capture workspace identity at initiation. A result started in A must not be attached to B after a switch.

Clear/invalidate A's visible content on switch, load B, and reject obsolete responses using scope/request identity checks. Abort obsolete requests where possible. Cache keys include workspace and relevant shared-library revision.

A running A job continues in A while B is selected. Deleting A is the separate action that cancels it.

### Surfaces

- Desktop retains its selector and receives complete create/rename/delete management.
- Mobile selection/management lives in `Advanced Settings`; display current workspace where necessary to make actions unambiguous.
- Both use shared lifecycle services and scope rules.
- Existing mobile features receive isolation; porting every desktop-only editor is not part of this release.
- All UI copy is English.

## 5. Protected Default

Protection is bound to the original identity, not its display name, current selection or mutable `isDefault` flag alone.

- UI, API, bulk cleanup and ordinary application database operations cannot delete it.
- Renaming or selecting another workspace does not remove protection.
- Generic update APIs cannot unset protection or replace canonical Default identity.
- Exactly one original protected Default exists for this installation/user; initialization is idempotent.
- Enforce protection in UI, service and database.
- Individual content inside Default can still be explicitly deleted normally. The workspace is protected, not an immutable archive.

## 6. Browser drafts and media

Server migrations cannot read a user's IndexedDB/localStorage. Migrate browser-only content independently per browser.

- Namespace drafts and related user-content keys by stable workspace ID.
- Assign legacy drafts, presets, helper instructions, reuse payloads and media to protected Default, regardless of selection when migration runs.
- Preserve legacy source values until the migrated copy is verified; never overwrite newer scoped Default data.
- Make migration versioned, repeatable and recoverable from interruption/quota errors.
- Track media references across all persisted drafts. Never compare the entire IndexedDB store with only the active draft and delete the remainder.
- Preserve media IDs/blobs while establishing ownership; suspend destructive cleanup until legacy references are classified.
- Preserve unresolved legacy values for recovery.
- Deleting A's browser data must not clear B or global settings.
- Other/offline browsers reconcile deleted IDs when reconnecting. Migration markers/tombstones prevent old values from re-importing deleted content.
- Browser draft synchronization across devices is not promised.

## 7. LoRA ownership and sharing

The visible library is `owned(activeWorkspace) + shared(protectedDefault)`.

Use a `Shared from Default` badge. Default sees each record once. Sharing is a flag on the source, not a duplicate.

- Only Default-owned LoRAs expose `Share with all workspaces`.
- Sharing includes future workspaces automatically.
- Editing metadata/files/helper profiles, deleting and changing visibility are Default-only actions.
- Consumers select shared LoRAs and set weights in their own drafts; they cannot mutate the source.
- Sharing does not expose Default's gallery, characters, prompts, presets or other content.
- WAN high/low pairs must be shared and exposed coherently. Never pair across different owners, unrelated directories or incompatible visibility.
- All 88 existing LoRAs remain private initially.

### Unshare and deletion

- Unshare hides the item from other workspaces for new use but retains its source.
- Preserve consumer drafts/presets with unavailable references; show what needs correction before submission. No silent substitute.
- Already accepted jobs keep their captured owner and resolved references. Unsharing does not rewrite them.
- Deleting a shared LoRA in Default warns about all consumers.
- Block new use and handle accepted jobs referencing the source before physically deleting it. A pending deletion can wait for those jobs to finish; do not delete bytes underneath an active consumer.
- Unsharing/source deletion does not delete historical generated media or generation snapshots.
- External S3 removal may still break accepted jobs; report missing dependencies honestly.
- Deleting a consumer workspace never deletes shared Default sources or helper profiles.

## 8. S3 layout and safe synchronization

The connection/bucket stays global; the owner determines the namespace.

| Owner | S3 keys | Runtime references |
| --- | --- | --- |
| Protected Default | Existing direct files in `loras/` | Existing `/runpod-volume/loras/<file>` |
| Other workspace | `loras/workspaces/<workspace-id>/<file>` | `/runpod-volume/loras/workspaces/<workspace-id>/<file>` |

Normal uploads/discovery use direct files in the assigned directory. Arbitrary nested user-directory import is out of scope. Root Default sync excludes `workspaces/` and directory entries.

No existing files move. Sharing changes visibility, not keys. Storage identity includes target and full key; basenames are not globally unique.

Bind uploads, multipart init/finalize/abort, sync and deletion to immutable owner/target at initiation. UI switches or connection edits cannot redirect completion. Do not silently overwrite unrelated objects with the same upload name.

### Reconciliation

1. Validate workspace, target fingerprint, namespace and reconciliation coordination.
2. Read a complete successful listing, including all pages. Missing output, malformed JSON, partial pages and errors are not empty-directory evidence.
3. Add discoveries to the owner. Preserve existing metadata, including base model, target type and helper information.
4. Find absent candidates among owned S3-managed records for the same target/prefix only. Exclude shared items merely visible to a consumer.
5. Confirm each candidate with an object-level check. Only genuine object-not-found on a verified unchanged bucket/target establishes absence; 403, timeouts and ambiguous responses do not.
6. Any listing, target-validation or absence-check error suppresses the whole destructive phase.
7. Revalidate owner, key and concurrent upload/delete revisions before transactional pruning.
8. Delete confirmed-missing records and dependent helper profiles; reconcile live selections without erasing historical snapshots.
9. Report additions, preserved items, removals and failures accurately.

A complete, genuinely empty directory may remove its owned records after these checks, without a new manual confirmation for each normal sync. A changed endpoint/bucket does not authorize clearing the old library: require explicit target reconciliation first.

Coordinate sync with uploads and deletion. A stale listing cannot prune a newly finalized upload. Do not label a failed or deletion-suppressed sync as fully successful.

### Generation compatibility

Current image submission can strip paths to basenames. New workspace prefixes cannot ship until supported adapters/secure transport preserve the canonical relative key and resolve the correct remote file.

Keep Default-root references compatible. Validate LoRA IDs/paths server-side; reject traversal, arbitrary paths and another workspace's private source.

Active endpoint code/deployment locations still need verification. Test nested paths with fixtures/mocks or separately approved live runs; a successful upload is not proof of generation compatibility.

## 9. Workspace deletion

Deletion is a durable resumable operation, not a single cascade.

### User contract

Show the workspace name, counts and a clear warning that deletion includes jobs, local files and owned S3 objects. Require deliberate confirmation, for example entering its name. Default has no delete action and server-side attempts fail.

No transfer, reassignment to Default or unassigned jobs. Deleting the active workspace shows status and requires an explicit next choice.

### Lifecycle

1. **Preflight:** reject protected Default; build an ownership/reference manifest; verify cancellation/cleanup access.
2. **Lock:** mark deleting; reject new submissions, uploads, sync and content edits.
3. **Drain/cancel:** stop scheduling, cancel queued/running upstream jobs, stop local rendering/materialization/preview producers, and observe cancellation/terminal state. Sending a request alone is insufficient.
4. **Fence:** keep deletion identity/tombstone so late callbacks, polling and upload completion cannot recreate content.
5. **Clean resources:** remove exclusive owned files/objects from the manifest, deduplicate paths, abort owned multipart uploads, and retain shared/global sources.
6. **Clean records:** remove dependencies safely after external cleanup outcomes are recorded.
7. **Complete:** retain a minimal audit/tombstone without user content; invalidate caches and reconcile browser copies on contact.

Cancellation, S3, unlink and ambiguous-ownership failures leave a visible pending/failed deletion with retry. Do not report completion while resources remain unresolved. Retry handles already-missing files and already-terminal jobs idempotently.

Late provider output is cleaned as owned output, not imported into a deleted gallery.

### Boundaries and recovery

- Never recursively delete `generations/`, `loras/`, a bucket, or arbitrary paths from request JSON.
- Validate canonical paths, symlink containment and full S3 keys.
- Preserve files required by another valid owner. Unclear historical ownership blocks that cleanup until resolved.
- Existing directories stay in place; manifests enable precise deletion without relocation.
- A SQLite rollback cannot restore a deleted file/S3 object. Recovery requires verified backups or available object versions.
- Live data deletion is distinct from operational backup retention. Do not promise erasure of every offline backup.
- Global configuration and unrelated workspaces never enter a deletion manifest.

## 10. Migration and rollout

Use a versioned additive-first migration, rehearsed on an isolated consistent copy, followed by a coordinated cutover.

1. Inventory content roots, child relations, file families, storage targets and all background writers.
2. Capture fresh counts/IDs/relations/manifests; create and verify restorable backups.
3. Protect original Default before exposing new destructive workspace behavior.
4. Add missing ownership and backfill previously global content to original Default.
5. Repair the historical `Preset.userId = workspaceId` convention, preserving preset IDs/options and not consulting active browser selection.
6. Preserve valid existing owners; stop on ambiguity or orphan relationships.
7. Validate ownership before enforcing constraints.
8. Deploy coordinated server/client behavior; reject old unscoped callers safely instead of silently assigning to Default.
9. Migrate browsers lazily and non-destructively.
10. Compare manifests, reopen historical content and prove rerun safety before enabling deletion.

The repository currently uses `prisma db push` and has no established migration chain for this change. No blind reset or `--accept-data-loss`. Any SQLite table rebuild must explicitly preserve rows/keys/relationships and be rehearsed.

Do not blindly restore an old database after accepting new content. Rollback must account for post-cutover writes and irreversible external deletions.

## 11. Acceptance criteria

| ID | Required evidence |
| --- | --- |
| AC01 | Pre/post IDs, relations, fields, counts and file/object manifests preserve Default; integrity checks pass |
| AC02 | Legacy roots/presets resolve to original Default; migration rerun changes nothing |
| AC03 | Reload, navigation, tab interaction, polling, failures and late responses do not switch or mix workspaces |
| AC04 | Every content endpoint/writer passes A/B, direct-ID, cross-reference and mixed-bulk isolation tests |
| AC05 | Browser drafts/media survive migration; GC/deletion preserves other workspace blobs |
| AC06 | Desktop/mobile management semantics match; mobile controls are in Advanced Settings |
| AC07 | Default deletion/protection bypasses fail via UI, API, flags, renaming and database guards |
| AC08 | Shared LoRAs have one Default source; coherent WAN pairs, read-only consumers and historical outputs are preserved |
| AC09 | S3 errors, incomplete/malformed lists, changed targets and upload races never prune; confirmed absence can |
| AC10 | Namespaced LoRAs resolve across adapters without basename collisions or Default-root regressions |
| AC11 | Non-default deletion cancels/drains, removes owned content, retries safely and preserves Default/shared/global data |
| AC12 | Late completions cannot resurrect content; missing/deleting active selection requires explicit choice |
| AC13 | Global settings/connections remain shared; content presets/library settings remain isolated |
| AC14 | Staging restore and rollout/rollback are demonstrated without paid runs |

## 12. Non-goals and implementation gates

Not included: transfer/copy tools, sharing entire workspaces, automatic Default sharing, per-workspace credentials, arbitrary S3 folder import, new multi-user auth, browser draft cloud sync or local helper model changes.

Resolve these operational facts before rollout:

- Active endpoint/transport sources and nested-path support.
- All writer processes and safe pause/drain procedures.
- Backup location/capacity, local and S3 recovery coverage.
- Remaining browser keys, seed/import paths and file-reference families.
- Reporting/recovery of ambiguous legacy records without dropping them.

These gates do not authorize implementation. A separate user command is required.
