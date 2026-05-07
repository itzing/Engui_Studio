# Shared Preview Materialization and Character Previews Specification

## Status
Draft implementation specification.

## Related backlog items
- ENGUI-201 — Implement shared preview materialization and character previews
- ENGUI-201.1 — Extract feature-owned generation submission service for preview jobs
- ENGUI-201.2 — Add generic job materialization task framework and supervisor registry
- ENGUI-201.3 — Add character preview state model and durable handler
- ENGUI-201.4 — Build Character Manager preview generation and persistence UI
- ENGUI-201.5 — Surface character portrait thumbnails across selectors and cards
- ENGUI-201.6 — Migrate scene and Studio Session preview handlers onto the shared framework
- ENGUI-111 — Add character image trait extraction to Character Manager
- ENGUI-109 — Add scene prototype preview and thumbnail flow

## Purpose
Define a durable server-owned preview pipeline for Character Manager and a reusable materialization framework that can later absorb other generated-artifact flows such as scene previews and Studio Session outputs.

The immediate product goal is simple:
- a user can generate preview images for a character,
- those images remain attached to that character after reloads or closed tabs,
- other parts of the product can show the character visually instead of only by name.

The architectural goal is broader:
- preview attachment must not depend on client-side polling as the source of truth,
- materialization logic should be reusable across features,
- successful job outputs should be attached to their owning domain object by backend infrastructure, not by whichever screen happened to be open.

## Current state

### Character Manager today
Current Character Manager preview cards are scaffolds only.

Observed state:
- `src/components/characters/CharacterManagerPanel.tsx` renders three preview cards:
  - Portrait preview
  - Upper-body preview
  - Full-body preview
- those cards currently only summarize mapped trait chips and display placeholder text such as `Preview scaffold ready`
- there is no preview image field on `CharacterSummary`
- there is no preview generation route for characters
- there is no durable preview materialization flow for characters

### Character persistence today
Current `Character` persistence stores only text metadata:
- `name`
- `gender`
- `traits`
- `editorState`
- `currentVersionId`
- `previewStatusSummary`

There is no persisted preview asset state such as:
- preview image URL
- preview job ID
- per-slot preview status
- materialization error

### Other preview pipelines today
Two other patterns already exist in the repo:

1. **Studio Sessions**
- has a durable, server-owned, feature-specific materialization pipeline
- uses `StudioSessionJobMaterialization`
- recovery is driven by supervisor-side sweeps
- result attachment does not depend on the page staying open

2. **Scene Manager**
- has preview generation and image attachment
- but the result persistence is driven from UI state by watching the job and saving the finished URL back into the scene
- this is functional, but not the durability standard we want to copy

## Problems to solve
1. Character previews are not real assets yet.
2. The current preview sidebar suggests capability that does not actually exist.
3. Other selectors cannot show visual character identity because no preview image is stored on the character.
4. The repo has one durable feature-specific materialization path and one client-driven preview path, but no shared framework.
5. New preview-like features would otherwise keep re-implementing job completion logic separately.

## Goals
1. Make character previews real, persistent, and reload-safe.
2. Keep backend materialization as the source of truth.
3. Support three character preview slots:
   - `portrait`
   - `upper_body`
   - `full_body`
4. Use `portrait` as the default thumbnail across the rest of the UI.
5. Introduce a reusable materialization framework that can support multiple target types.
6. Avoid client-side polling as the mechanism that decides whether an asset becomes attached.
7. Preserve current Studio Sessions behavior while giving the codebase a path toward convergence.

## Non-goals
- Full automatic generation of all preview slots on every character save.
- Bulk regeneration orchestration in the first pass.
- Immediate removal of the current Studio Sessions materialization table before the shared framework is proven.
- Redesigning the full Character Manager information architecture beyond what is needed for preview generation and display.
- Migrating every historical preview-like feature in the same commit.

## Design principles
1. Job submission and job materialization are separate concerns.
2. Materialization is backend infrastructure, not view logic.
3. Preview state must be durable and survive tab closure.
4. A feature must own its submission request, not rely on the generic `/api/generate` page route as a client-only entry point.
5. Shared infrastructure should be generic, but feature handlers should stay explicit and typed.
6. Existing stable flows should be migrated incrementally, not rewritten blindly.

## Recommended approach
Build a shared materialization framework now, but adopt it incrementally.

### Immediate adoption target
- Character preview generation and attachment

### Migration path after that
- Scene preview attachment
- Studio Session materialization convergence

This avoids using Character Manager as yet another one-off preview pipeline, while also avoiding a risky all-at-once refactor of already-working Studio Session durability.

## Target architecture

### 1. Extract a shared server-side generation submission service
Current preview creation in Scene Manager submits to `/api/generate` directly from the client.

For Character previews, the recommended design is:
- add a shared server-side submission helper in `src/lib/generation/` or similar,
- let feature-owned routes call that helper,
- create the local job row plus feature materialization task inside one backend flow,
- keep `/api/generate` as the generic public route, but refactor it to reuse the same shared helper.

This gives feature routes a clean way to say:
- create preview job for this character and slot,
- attach durable materialization metadata at creation time.

### 2. Add a generic materialization task model
Introduce a shared table such as `JobMaterializationTask`.

Recommended shape:

```prisma
model JobMaterializationTask {
  id             String   @id @default(uuid())
  jobId          String
  workspaceId    String?
  targetType     String
  targetId       String
  payloadJson    String   @default("{}")
  status         String   @default("pending")
  attemptCount   Int      @default(0)
  lastAttemptAt  DateTime?
  materializedAt DateTime?
  lastError      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  job            Job      @relation(fields: [jobId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@unique([jobId, targetType, targetId])
  @@index([targetType, status, updatedAt(sort: Desc)])
  @@index([targetId, status, updatedAt(sort: Desc)])
  @@index([status, updatedAt(sort: Desc)])
}
```

Why this shape:
- supports one or more materialization targets per job if ever needed,
- keeps materialization ownership generic,
- avoids hard-coding Studio Session-specific columns into shared infrastructure.

### 3. Add a materialization handler registry
Create a registry layer such as:
- `character_preview`
- `scene_preview`
- `studio_session_version`

Handler contract should look conceptually like:

```ts
type MaterializationHandler = {
  targetType: string;
  materialize(task: JobMaterializationTaskRecord, job: JobRecord): Promise<void>;
  onSourceJobFailed?(task: JobMaterializationTaskRecord, job: JobRecord): Promise<void>;
};
```

The supervisor should:
- recover pending/processing/failed tasks,
- load the source job,
- dispatch to the correct handler by `targetType`,
- mark the task `materialized` or `failed`.

### 4. Keep backend completion authoritative
The page may still display live status by reading current job state, but it must not be responsible for attaching the final image to the feature entity.

Client polling is allowed only for UX polish such as:
- showing `Queued` or `Running`
- refreshing the visible card sooner

It must not be the only path that persists the final preview.

## Character preview state model

### Character storage
Add a durable preview state payload to `Character`.

Recommended addition:

```prisma
previewStateJson String @default("{}")
```

Recommended runtime shape:

```ts
type CharacterPreviewSlot = 'portrait' | 'upper_body' | 'full_body';

type CharacterPreviewSlotState = {
  slot: CharacterPreviewSlot;
  status: 'idle' | 'queued' | 'running' | 'ready' | 'failed';
  jobId: string | null;
  imageUrl: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  error: string | null;
  promptSnapshot: string | null;
  updatedAt: string | null;
};

type CharacterPreviewState = {
  portrait: CharacterPreviewSlotState;
  upper_body: CharacterPreviewSlotState;
  full_body: CharacterPreviewSlotState;
};
```

### Summary projection
`CharacterSummary` should expose:
- `previewState`
- `primaryPreviewImageUrl` derived from `previewState.portrait.imageUrl`
- optionally `primaryPreviewThumbnailUrl`

This keeps consumer UIs simple.

## Character preview prompt scaffolds
Character preview prompts should be deterministic and slot-specific.

### Portrait
Groups:
- identity
- face
- hair

Output goal:
- visual identity thumbnail suitable for selectors
- square or portrait framing

### Upper body
Groups:
- hair
- body
- posture

Output goal:
- clear chest-up or torso-inclusive reference

### Full body
Groups:
- body
- lower-body
- posture

Output goal:
- full silhouette and stance reference

### Shared rules
All preview scaffolds should:
- use English prompts
- have stable, reusable composition defaults
- avoid overly decorative prompt noise
- store the rendered prompt snapshot in preview state for debugging and regeneration transparency

## API contract

### New route
Recommended route:
- `POST /api/characters/[id]/preview`

Body:

```json
{
  "slot": "portrait"
}
```

Behavior:
1. validate character exists and is not deleted
2. build slot-specific prompt scaffold from persisted character traits
3. create generation job through shared server-side submission helper
4. enqueue generic materialization task with:
   - `targetType: "character_preview"`
   - `targetId: characterId`
   - `payload: { slot: "portrait" }`
5. update character preview slot state to queued/running with linked job id
6. return job id plus updated preview state

### Character GET/PUT responses
Character summary responses should include preview fields so other screens do not need custom preview fetches.

## Character Manager UI changes
The current preview rail should become functional.

Each preview card should show:
- current image if available
- fallback empty state if not available
- current slot status
- `Generate` when no image exists
- `Regenerate` when an image already exists
- failure state with last error if materialization failed

The current `Preview scaffold ready` placeholder should no longer be the terminal UI state.

## Cross-surface thumbnail usage
After character preview state is available, the following surfaces should use `portrait` as the default thumbnail:
- Character list rows in Character Manager
- Character selectors in Scene Manager
- Character pickers in Prompt Constructor
- Character selector in Studio Sessions template editor
- any image generation character dropdown or chooser that already consumes `CharacterSummary`

The first pass does not need a major visual redesign. A small thumbnail next to the name is enough.

## Incremental rollout plan

### Phase 1 — shared preview submission contract
- extract shared server-side generation submission helper
- keep `/api/generate` working by delegating into the helper
- define preview materialization payload contract

### Phase 2 — generic materialization infrastructure
- add `JobMaterializationTask`
- add registry and supervisor dispatch
- wire recovery sweep into the supervisor

### Phase 3 — character preview backend
- add `previewStateJson` to `Character`
- add serializers/types/projections
- add `character_preview` materialization handler
- add `POST /api/characters/[id]/preview`

### Phase 4 — Character Manager UI
- make preview cards render real images and statuses
- add generate/regenerate actions per slot
- show active job feedback and durable result after reload

### Phase 5 — consumer thumbnails
- expose portrait thumbnail in all major character selectors
- verify it remains attached after save, reload, and character edits

### Phase 6 — framework adoption follow-up
- migrate Scene preview attachment to the shared materialization framework
- migrate Studio Session materialization from feature-specific task storage onto the shared framework once parity is proven

## Risks and mitigations

### Risk: refactoring `/api/generate` destabilizes general job creation
Mitigation:
- extract shared submission logic without changing request contract first
- cover with focused route tests and one live smoke path

### Risk: shared materialization becomes too generic and vague
Mitigation:
- keep registry explicit
- keep `targetType` handlers small and feature-owned
- keep payload typed per handler

### Risk: character preview state becomes hard to consume
Mitigation:
- store the full JSON state for durability
- also project `primaryPreviewImageUrl` in `CharacterSummary`

### Risk: migrating Studio Sessions too early could regress a working flow
Mitigation:
- ship Character preview on shared framework first
- migrate Studio Sessions only after the generic task lifecycle proves stable

## Acceptance criteria
1. Character Manager can generate portrait, upper-body, and full-body previews.
2. A generated preview remains attached after reload and after closing the page.
3. Character preview materialization is backend-owned and recoverable.
4. `portrait` preview appears in downstream character selectors.
5. The shared materialization framework is generic enough to support scene and Studio Session handlers.
6. The current non-functional preview scaffold UX is replaced with real preview lifecycle states.
