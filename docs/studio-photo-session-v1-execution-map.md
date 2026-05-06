# Studio Photo Session v1 Execution Map

Companion document to:
- `docs/studio-photo-session-v1-spec.md`
- `docs/studio-photo-session-v1-implementation-plan.md`
- backlog phases `ENGUI-226` through `ENGUI-232`

This document is the practical start-order map for implementation.
It is intentionally pre-implementation.
Its goal is to show:
- what should start first,
- what can run in parallel,
- where to pause and re-evaluate,
- and which downstream tickets are most likely to shift after real foundation work lands.

---

## Core rule

Do **not** start Phase 2+ implementation until the `ENGUI-226.*` foundation slice is complete and reviewed.

Reason:
- the Prisma shape,
- pose-library normalization,
- template vs draft vs snapshot contracts,
- and derived helper boundaries

may still force small ticket reshaping later.

So the execution plan is:
1. finish `226.*`,
2. run a foundation review checkpoint,
3. only then start product-surface implementation.

---

## Recommended first execution batch

### Batch A — foundation only
Start here and stop nowhere else first.

1. `ENGUI-226.1` — add Prisma schema and workspace relations
2. `ENGUI-226.2` — add static pose-library dataset and normalization layer
3. `ENGUI-226.3` — add domain types and payload contracts
4. `ENGUI-226.4` — add resolution, prompt, status, and labeling helpers
5. `ENGUI-226.5` — add unique-random picking and run-level pose-history helpers

### Parallelism inside Batch A
Safe parallel start:
- `ENGUI-226.1`
- `ENGUI-226.2`

Then:
- `ENGUI-226.3` after `226.1 + 226.2`
- `ENGUI-226.4` after `226.3`
- `ENGUI-226.5` after `226.2 + 226.3`

### Why this batch is isolated
This batch locks:
- canonical storage shape,
- canonical API/domain payloads,
- the static pose catalog contract,
- auto-pick uniqueness behavior,
- and shared derived logic.

If these foundations drift midstream, almost every later ticket becomes noisier.

---

## Mandatory checkpoint after `226.*`

Before starting `227.*`, do a short review pass against real code and answer these questions:

1. **Schema sanity**
   - Are template, run, shot, revision, and version boundaries still correct?
   - Is `ShotVersion` still sufficient as the v1 asset holder?

2. **Draft/save/snapshot contract sanity**
   - Is the split between autosaved draft, canonical saved template, and immutable run snapshot still clean?

3. **Pose-library sanity**
   - Are category/orientation/framing fields stable enough for UI and snapshotting?
   - Is library versioning/hash exposure enough for future reproducibility?

4. **Helper-boundary sanity**
   - Is prompt assembly centralized enough?
   - Is run status derivation stable enough to build UI on top of?

5. **Migration/seed sanity**
   - Does the schema need migration helpers, fixture data, or small bootstrapping utilities that should become explicit tickets?

### Expected outcome of this checkpoint
One of two outcomes should happen:

- **Outcome A — proceed unchanged**
  - keep the existing `227.*` to `232.*` split

- **Outcome B — reshape lightly before implementation continues**
  - split one or two heavy tickets
  - merge one or two thin tickets
  - adjust dependencies where the real foundation suggests cleaner seams

This is the only planned reshaping gate.
After this point, implementation should mostly flow forward.

---

## Recommended execution lanes after the foundation checkpoint

## Lane 1 — template surface
This is the first product lane.

### Order
1. `ENGUI-227.1` — desktop route shell with Templates and Runs tabs
2. `ENGUI-227.2` — template CRUD and clone API routes
3. `ENGUI-227.3` — template list surface
4. `ENGUI-227.4` — template editor base form and character integration
5. `ENGUI-227.5` — generation controls and autosave vs explicit save model
6. `ENGUI-227.6` — compact category slider panel and template validation

### Parallelism
After `227.1 + 227.2`:
- `227.3` and `227.4` can move in parallel

Then:
- `227.5` after `227.4`
- `227.6` after `227.5`

### Exit condition
Do not start Phase 3 until:
- saved templates are real,
- explicit save vs autosave draft is working,
- and `Create Run` can trust canonical saved template state.

---

## Lane 2 — run creation and first run workspace

### Order
1. `ENGUI-228.1` — run creation service with immutable template snapshots
2. `ENGUI-228.2` — stable shot slots and grouping metadata
3. `ENGUI-228.3` — runs list APIs and product-status derivation
4. `ENGUI-228.4` — Runs list surface
5. `ENGUI-228.5` — run detail shell with grouped unassigned shot cards

### Parallelism
After `228.1`:
- `228.2` and `228.3` can run in parallel

Then:
- `228.4` after `227.1 + 228.3`
- `228.5` after `228.2 + 228.3`

### Exit condition
Do not start execution or review work before there is a stable run shell with stable slot identity.

---

## Lane 3 — pose assignment and pre-run preparation

### Order
1. `ENGUI-229.1` — single-shot auto-pick and first revision creation
2. `ENGUI-229.2` — manual pose picker API and desktop picker UI
3. `ENGUI-229.3` — assemble-all bulk pose assignment
4. `ENGUI-229.4` — shot reshuffle with revision lineage
5. `ENGUI-229.5` — assigned shot cards with prompt preview and actions
6. `ENGUI-229.6` — exhausted-pose-pool UX

### Parallelism
After `228.5` and foundation helpers are ready:
- `229.1` and `229.2` can start in parallel

Then:
- `229.3` after `229.1`
- `229.4` after `229.1`
- `229.5` after `229.1 + 228.5 + 226.4`
- `229.6` after `229.3 + 229.4`

### Important rule
Do not bypass revision creation.
Assignment and reshuffle should harden the revision model early, because Phase 5 and Phase 6 depend on it.

---

## Lane 4 — execution and result materialization

### Order
1. `ENGUI-230.1` — run-shot execution requests with studio-session job context
2. `ENGUI-230.2` — auto-pick/bootstrap revisions when running unassigned shots
3. `ENGUI-230.3` — materialize completed studio jobs into shot versions
4. `ENGUI-230.4` — run-all execution and per-shot active job state
5. `ENGUI-230.5` — first-version auto-selection and version-first shot rendering

### Parallelism
After `230.1`:
- `230.2`, `230.3`, and `230.4` can proceed with care in parallel

Then:
- `230.5` after `230.3`

### Critical note
`230.3` is the real hinge.
If job-to-version materialization feels heavier than expected during implementation, this is the most likely downstream ticket to split further.

---

## Lane 5 — review, curation, and gallery handoff

### Order
1. `ENGUI-231.1` — card-level version browsing and selected-version switching
2. `ENGUI-231.2` — shot detail viewer with current revision focus and revision history
3. `ENGUI-231.3` — hide/reject controls for shot versions
4. `ENGUI-231.4` — skip and restore shot actions with completion rules
5. `ENGUI-231.5` — explicit Add to Gallery from studio shot versions

### Parallelism
After `230.5`:
- `231.1`, `231.2`, and `231.4` can move in parallel

Separately:
- `231.5` can start after `230.3`

Then:
- `231.3` after `231.1 + 231.2`

### Important rule
Keep current-revision browsing and revision-history browsing distinct in the UI.
That separation is a core product decision, not polish.

---

## Lane 6 — hardening and stabilization

### Order
1. `ENGUI-232.1` — regression coverage for core domain rules
2. `ENGUI-232.2` — manual QA matrix across template, run, and review workflows
3. `ENGUI-232.3` — consolidate studio-session logic and harden API validation
4. `ENGUI-232.4` — performance and usability polish on large runs and deep histories

### Parallelism
After Phase 6 core work exists:
- `232.2` and `232.3` can run in parallel

Then:
- `232.1` after `231.4 + 231.5`
- `232.4` after `231.2 + 232.3`

### Goal
This lane should harden the module, not reopen the architecture.
If architecture still feels unstable here, the real issue was earlier phase drift.

---

## Best practical start order

If the work is done sequentially by one person, use this exact order:

1. `226.1`
2. `226.2`
3. `226.3`
4. `226.4`
5. `226.5`
6. **checkpoint**
7. `227.1`
8. `227.2`
9. `227.4`
10. `227.5`
11. `227.6`
12. `227.3`
13. `228.1`
14. `228.2`
15. `228.3`
16. `228.5`
17. `228.4`
18. `229.1`
19. `229.2`
20. `229.5`
21. `229.3`
22. `229.4`
23. `229.6`
24. `230.1`
25. `230.3`
26. `230.2`
27. `230.4`
28. `230.5`
29. `231.1`
30. `231.2`
31. `231.4`
32. `231.3`
33. `231.5`
34. `232.3`
35. `232.1`
36. `232.2`
37. `232.4`

This order is optimized for reducing rework, not for maximizing parallel throughput.

---

## Best parallel start order

If multiple implementation threads are available, use this structure:

### Thread A — domain foundation
- `226.1`
- `226.3`
- `226.4`

### Thread B — pose library foundation
- `226.2`
- `226.5`

### Thread C — template product surface
Start only **after** the `226.*` checkpoint:
- `227.1`
- `227.2`
- `227.3` / `227.4`
- `227.5`
- `227.6`

### Thread D — run and preparation surface
After Phase 2 stabilizes:
- `228.1`
- `228.2` / `228.3`
- `228.4` / `228.5`
- `229.1` / `229.2`
- `229.3` / `229.4` / `229.5`
- `229.6`

### Thread E — execution and review surface
After Phase 4 stabilizes:
- `230.1`
- `230.2` / `230.3` / `230.4`
- `230.5`
- `231.1` / `231.2` / `231.4`
- `231.3`
- `231.5`
- `232.*`

---

## Tickets most likely to change after real foundation work

These are the tickets most likely to need re-splitting after `226.*`:

### Highest likelihood
- `ENGUI-228.3`
  - product status derivation may deserve its own deeper helper/test slice
- `ENGUI-230.3`
  - job completion materialization may split into backend persistence vs UI consumption
- `ENGUI-231.2`
  - shot detail viewer may split into revision-history shell vs version-browser UX

### Medium likelihood
- `ENGUI-227.5`
  - autosave vs explicit save can surface edge cases that justify a narrower follow-up ticket
- `ENGUI-229.5`
  - prompt preview rendering may need separation if the preview UX becomes noisy
- `ENGUI-232.4`
  - performance polish may grow into explicit virtualization or pagination follow-ups

This does **not** mean those tickets are wrong now.
It only means they sit closest to real implementation uncertainty.

---

## What not to do

- Do not start the Studio Sessions UI before the domain contracts exist.
- Do not let run creation depend on unsaved editor draft state.
- Do not treat active jobs as the long-term result model.
- Do not collapse revision history and version browsing into one muddy abstraction.
- Do not auto-mix Studio Session outputs into Gallery.
- Do not skip the `226.*` checkpoint and hope to clean it up later.

---

## Recommended immediate next step

The next implementation start should be:

1. `ENGUI-226.1`
2. `ENGUI-226.2`
3. then the rest of `226.*`

After that, pause for the planned checkpoint before any `227.*` coding begins.
