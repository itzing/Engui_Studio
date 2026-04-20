# Unified Create State Implementation Specification

## Status
Draft implementation specification for the unified create-state initiative.

## Related backlog items
- ENGUI-150 - Unify create state per workflow and model across mobile and desktop
- ENGUI-151 - Build unified create draft store v2 and storage adapters
- ENGUI-152 - Add route-scoped mobile create provider and migrate image flow
- ENGUI-153 - Implement transactional model switching and draft normalization
- ENGUI-154 - Persist mobile create local media via IndexedDB refs
- ENGUI-155 - Convert mobile reuse actions to store-first create transitions
- ENGUI-156 - Extend unified create state to video, TTS, and music mobile flows
- ENGUI-157 - Run unified create state regression, PWA QA, and cleanup legacy sync hacks
- ENGUI-158 - Converge desktop create forms onto the unified draft store contract

## Purpose
Define the implementation contract for replacing the current multi-instance create-state behavior with a unified store that is safe under App Router caching, Safari, and iOS PWA standalone mode.

This specification is mobile-first because the current failures are most visible there, but the data model and storage contract must also support later desktop convergence.

## Background
The current implementation mixes three different responsibilities inside route-level hooks and event bridges:
- live in-memory UI state,
- persistence to `localStorage`,
- cross-route synchronization.

That design is fragile because mobile create screens are separate routes under `/m/create/*`, and each route can mount its own `useImageCreateState()` instance.

Current hotspots:
- `src/hooks/create/useImageCreateState.ts`
- `src/hooks/create/useImageCreateDraftPersistence.ts`
- `src/lib/createDrafts.ts`
- `src/components/mobile/MobileRouteEventBridge.tsx`
- `src/app/m/create/page.tsx`
- `src/components/mobile/create/*`

## Observed problems
1. Multiple mobile create screens own separate local React state.
2. Each screen hydrates from storage independently.
3. Each screen persists independently.
4. Mobile model selection depends on repair logic such as pending keys, custom events, `pageshow`, `focus`, and `visibilitychange` listeners.
5. Reuse behavior depends on event dispatch and route timing rather than a canonical state transition.
6. The current storage format stores only lightweight snapshots and is not designed for durable local media references.
7. `StudioContext` still exposes a single global `selectedModel`, which conflicts conceptually with per-workflow and per-model draft preservation.

## Goals
1. One live create-state owner per mounted route subtree.
2. Durable draft persistence per workflow and per model.
3. Deterministic model switching with exact draft restoration.
4. Store-first reuse flows for `txt2img`, `img2img`, and `img2vid`.
5. Robust handling for local media inputs selected on mobile.
6. Minimal duplication between mobile and future desktop adoption.
7. No new third-party state library unless implementation complexity proves it necessary.

## Non-goals
- Rewriting desktop UI composition in the first mobile stabilization pass.
- Replacing existing backend reuse payload endpoints.
- Changing the visual information architecture of mobile create beyond what is necessary for state migration.
- Reworking unrelated jobs, gallery, or scene manager features.

## Design principles
1. Live state and persisted state are different concerns.
2. Storage is persistence, not the primary synchronization mechanism.
3. Route transitions must not be trusted as a synchronization boundary.
4. Reuse must write a complete target draft before navigation.
5. Local file durability must not rely on `data:` URLs inside `localStorage`.
6. Shared logic should be React-agnostic where practical.
7. Temporary repair hacks must be removed after migration.

## Storage decision
The solution uses a hybrid model:
- live route-tree state in memory,
- serialized draft envelopes in `localStorage`,
- local binary media in IndexedDB.

### Why not only `localStorage`
`localStorage` is acceptable for small JSON payloads such as:
- active workflow,
- active model per workflow,
- prompt text,
- parameter values,
- booleans and lightweight identifiers.

It is a poor fit for:
- large local images,
- blobs from file inputs,
- multiple drafts with preview payloads,
- durable mobile media across reloads.

### Why IndexedDB is required
IndexedDB is the correct durable store for local media selected from the device. It avoids quota pressure on `localStorage` and removes the need for serializing `data:` URLs inside draft snapshots.

## Target state ownership model

### Live owner
A single provider mounted under `/m/create/layout.tsx` owns live create state for the entire `/m/create/*` route tree.

### Persistent owner
A storage layer reads and writes a versioned serialized state document plus any referenced IndexedDB media objects.

### Consumers
All mobile create screens consume the provider through a dedicated hook such as `useMobileCreate()` or workflow-specific selectors on top of that provider.

No mobile create screen should instantiate an isolated persistence/hydration hook after the migration.

## Canonical state model

```ts
export type CreateWorkflow = 'image' | 'video' | 'tts' | 'music';

export type CreateDraftVersion = 2;

export type DraftEnvelope<TDraft = unknown> = {
  modelId: string;
  updatedAt: number;
  draft: TDraft;
};

export type WorkflowDraftBucket<TDraft = unknown> = {
  activeModel?: string;
  drafts: Record<string, DraftEnvelope<TDraft>>;
};

export type UnifiedCreateDraftState = {
  version: CreateDraftVersion;
  activeMode: CreateWorkflow;
  workflows: {
    image: WorkflowDraftBucket<ImageCreateDraftV2>;
    video: WorkflowDraftBucket<VideoCreateDraftV2>;
    tts: WorkflowDraftBucket<TtsCreateDraftV2>;
    music: WorkflowDraftBucket<MusicCreateDraftV2>;
  };
};
```

## Draft schemas

### Common fields
All workflow drafts should preserve a common shape where applicable:

```ts
export type CommonCreateDraftFields = {
  prompt: string;
  showAdvanced: boolean;
  parameterValues: Record<string, unknown>;
};
```

### Image draft

```ts
export type ImageCreateDraftV2 = CommonCreateDraftFields & {
  randomizeSeed: boolean;
  selectedSceneId?: string;
  inputs: {
    primary?: CreateMediaRef | null;
    secondary?: CreateMediaRef | null;
  };
};
```

### Video draft

```ts
export type VideoCreateDraftV2 = CommonCreateDraftFields & {
  inputs: {
    image?: CreateMediaRef | null;
    video?: CreateMediaRef | null;
    audio?: CreateMediaRef | null;
  };
};
```

### TTS draft

```ts
export type TtsCreateDraftV2 = CommonCreateDraftFields;
```

### Music draft

```ts
export type MusicCreateDraftV2 = CommonCreateDraftFields;
```

## Media reference model
Drafts must not embed raw `File`, `Blob`, or `data:` payloads.

```ts
export type CreateMediaRef =
  | {
      kind: 'remote-url';
      url: string;
      mimeType?: string;
      source?: 'scene' | 'gallery' | 'job' | 'external';
      sourceId?: string;
    }
  | {
      kind: 'gallery-asset';
      assetId: string;
      url: string;
      mimeType?: string;
    }
  | {
      kind: 'job-output';
      jobId: string;
      outputId?: string;
      url: string;
      mimeType?: string;
    }
  | {
      kind: 'idb-media';
      mediaId: string;
      fileName?: string;
      mimeType?: string;
      size?: number;
      lastModified?: number;
    };
```

### IndexedDB contract
- database name: `engui-create-media`
- schema version: `1`
- object store: `draft-media`
- primary key: `mediaId`

Suggested object payload:

```ts
export type StoredCreateMedia = {
  mediaId: string;
  blob: Blob;
  fileName?: string;
  mimeType?: string;
  size?: number;
  lastModified?: number;
  createdAt: number;
  updatedAt: number;
};
```

### Media cleanup
The implementation must include garbage collection for orphaned IndexedDB media entries.

Rules:
- compute referenced `mediaId` values from the unified draft state,
- delete orphaned entries that are not referenced by any draft,
- keep the cleanup lazy and opportunistic,
- never delete currently referenced entries,
- allow a time-based safety threshold such as 24 hours before deleting newly orphaned entries.

### Failure behavior
If IndexedDB is unavailable or write fails:
- keep the media in live memory for the current mounted session,
- persist the rest of the draft normally,
- mark the media ref as non-durable in memory only,
- do not fall back to large `data:` URLs in `localStorage`.

## Storage keys
- `engui.create.state.v2` for serialized unified draft state
- `engui-create-media` IndexedDB database for local media blobs

Legacy keys to retire after migration:
- `engui.create.state.v1`
- `engui.mobile.pending-image-model`
- `engui.mobile.pending-reuse-input`
- any temporary custom-event synchronization key introduced for the mobile patch cycle

## Proposed module layout

### Pure store and schema modules
- `src/lib/create/createDraftSchema.ts`
- `src/lib/create/createDraftStore.ts`
- `src/lib/create/createDraftMigrations.ts`
- `src/lib/create/createDraftNormalization.ts`
- `src/lib/create/createMediaStore.ts`
- `src/lib/create/createReuseActions.ts`

### Mobile provider modules
- `src/app/m/create/layout.tsx`
- `src/components/mobile/create/MobileCreateProvider.tsx`
- `src/components/mobile/create/useMobileCreate.ts`
- optional workflow selectors such as `useMobileImageCreate()`

### Compatibility adapters
- `src/lib/create/legacyCreateDraftAdapter.ts`
- compatibility wrapper for legacy `useImageCreateState()` callers during phased migration if needed

## Store API contract
The store should expose pure functions and provider actions for the following operations:

```ts
loadUnifiedCreateDraftState(): UnifiedCreateDraftState;
saveUnifiedCreateDraftState(state: UnifiedCreateDraftState): void;
migrateLegacyCreateDraftState(raw: unknown): UnifiedCreateDraftState;
getWorkflowBucket(state, workflow): WorkflowDraftBucket;
getActiveDraft(state, workflow): DraftEnvelope | null;
getDraft(state, workflow, modelId): DraftEnvelope | null;
setActiveMode(state, workflow): UnifiedCreateDraftState;
patchDraft(state, workflow, modelId, patch): UnifiedCreateDraftState;
switchWorkflowModel(state, args): UnifiedCreateDraftState;
applyReusePayload(state, payload): UnifiedCreateDraftState;
collectReferencedMediaIds(state): string[];
```

## Provider contract
The route-scoped provider should own:
- the in-memory `UnifiedCreateDraftState`,
- hydration lifecycle,
- persistence scheduling,
- IndexedDB media hydration,
- workflow/model actions,
- legacy bridge behavior where needed during migration only.

The provider should use a reducer or equivalent single-state update path. The important requirement is atomic state transitions, not a specific React primitive.

## Initialization algorithm
1. On provider mount, load `engui.create.state.v2` from `localStorage`.
2. If absent, read `engui.create.state.v1` and migrate it to v2.
3. Normalize the resulting state against current model definitions.
4. Ensure each workflow has an `activeModel` or a deterministic default model.
5. Hydrate any referenced IndexedDB media needed for the current screen.
6. Publish the initialized state once.
7. Remove legacy pending sync keys if the migration path no longer needs them.

## Persistence algorithm
1. Any draft mutation updates in-memory provider state first.
2. Persist the serialized v2 state after the reducer transition.
3. Debounce non-critical `localStorage` writes if needed.
4. Persist local file blobs to IndexedDB before publishing durable `idb-media` refs.
5. Keep persistence side effects outside pure normalization logic.

## Transactional model switching
Model switching must be a single state transition, not a sequence of loosely coupled effects.

### Required behavior
When switching from `currentModelId` to `nextModelId` inside a workflow:
1. capture the current live draft under `currentModelId`,
2. write it into `workflows[workflow].drafts[currentModelId]`,
3. set `workflows[workflow].activeModel = nextModelId`,
4. load existing target draft if present,
5. otherwise build a normalized default draft for the target model,
6. publish the final target draft as the live draft in one transition.

### Normalization rules
`normalizeDraftForModel(workflow, modelId, previousDraft)` must:
- merge target-model default parameter values,
- keep only parameters that belong to the target model,
- preserve prompt when moving within the same workflow unless a reuse action says otherwise,
- preserve compatible width and height values when valid for the target model,
- preserve seed and randomize settings only if the target model supports them,
- remove incompatible media inputs,
- clear `selectedSceneId` when switching away from image workflow,
- preserve `showAdvanced` as UI state where applicable,
- preserve only workflow-compatible inputs.

### Image-specific rules
- `z-image` image input is only meaningful when `use_controlnet === true`.
- switching from a model that allows image input to one that does not must clear image refs.
- switching from a two-image model to a one-image model must drop the second input.

### Video-specific rules
- only keep image, video, or audio refs supported by the target model.
- `img2vid` should preserve width and height if valid, otherwise apply target defaults.

### Audio and music rules
- no media ref retention unless the target model schema explicitly supports it.

## Reuse integration
The server reuse endpoints can stay as the canonical payload builders:
- `/api/gallery/assets/[id]/reuse/route.ts`
- `/api/jobs/[id]/reuse/route.ts`

The client must stop relying on event dispatch timing.

### New client flow
1. fetch canonical reuse payload,
2. resolve target workflow and model,
3. convert payload into a normalized target draft,
4. write the draft into the unified store,
5. set active mode and active model,
6. navigate to the destination route.

### Model resolution rules
- `txt2img`: target workflow `image`; use payload model if it is a valid image model, otherwise the default image model.
- `img2img`: target workflow `image`; prefer payload model if it supports image input, otherwise fall back to a deterministic compatible image model.
- `img2vid`: target workflow `video`; use payload model if it is a valid compatible video model, otherwise fall back to the designated default image-to-video model.

### Payload-to-draft rules
- prompt comes from payload prompt,
- model-specific parameters come from payload options after normalization,
- image and video source paths become `CreateMediaRef` values,
- incompatible inputs are dropped during normalization,
- target draft is stored before route change.

## Interaction with `StudioContext`
The current global `selectedModel` in `StudioContext` should not remain the source of truth for mobile create after migration.

### Transitional plan
- mobile create provider becomes the source of truth for workflow/model selection under `/m/create/*`,
- legacy desktop flows may still read from `StudioContext` during transition,
- if compatibility is required, expose adapter values derived from the unified store instead of writing model changes directly into multiple owners.

### End-state recommendation
`StudioContext` should not own create-draft model state directly. It may expose convenience selectors later, but the canonical state should live in the unified draft store layer.

## Route integration plan
- add `src/app/m/create/layout.tsx` to mount the provider once for the entire mobile create subtree,
- remove direct screen-level ownership of create persistence,
- convert `/m/create`, `/m/create/model`, `/m/create/prompt`, `/m/create/advanced`, and `/m/create/scenes` to provider consumers,
- keep `/m/create` mode switching driven by the unified store `activeMode` instead of an independent local state plus `localStorage` helper.

## Legacy behavior to remove
After migration, remove the following as sources of correctness:
- `engui.mobile.pending-image-model`
- `engui.mobile.pending-reuse-input`
- custom model-selection repair events
- `pageshow` model repair listener
- `focus` model repair listener
- `visibilitychange` model repair listener used only to resync create model state
- event-bridge reuse navigation that depends on later hydration

## Migration from v1
The existing `engui.create.state.v1` shape must be migrated in place.

### Migration rules
- `activeMode` carries over directly,
- workflow `activeModel` values carry over directly if they still reference valid models,
- workflow draft maps carry over per model,
- legacy image snapshots with `previewUrl` and `previewUrl2` must be converted into `inputs.primary` and `inputs.secondary`,
- legacy `data:` URLs should be imported into IndexedDB and replaced by `idb-media` refs when possible,
- legacy remote URLs should become `remote-url` refs,
- invalid or incompatible parameters should be normalized away.

### Migration safety
If migration fails:
- keep the app usable with a clean v2 default state,
- log a warning,
- do not crash the create flow,
- do not keep partially corrupted in-memory state.

## Testing plan

### Unit tests
Add tests for:
- v1 to v2 migration
- default draft creation per workflow and model
- transactional model switching
- draft normalization across incompatible models
- reuse payload mapping for `txt2img`, `img2img`, `img2vid`
- media ref serialization and IndexedDB lookup
- orphaned media garbage collection

### Integration tests
Add tests for:
- provider mounted once across `/m/create/*`
- state preserved while navigating between create subroutes
- returning from model screen reflects the selected model immediately
- selected local image survives route change and reload when durable persistence is available
- reuse from jobs and gallery lands on a fully populated destination draft

### Manual QA
Run a focused mobile QA pass covering:
- iPhone Safari browser mode
- iPhone PWA standalone mode
- local file selection
- model switching between `flux-krea`, `z-image`, and `qwen-image-edit`
- `txt2img`, `img2img`, `img2vid`
- route back/forward behavior
- desktop create regression

## Rollout plan
1. Build the pure store and migration layer.
2. Mount the route-scoped mobile provider.
3. Move image create screens to the provider.
4. Switch model transitions to the atomic store action.
5. Add IndexedDB media persistence.
6. Convert reuse flows to store-first transitions.
7. Extend non-image mobile workflows.
8. Run QA and remove legacy sync hacks.
9. Optionally migrate desktop create forms to the same contract.

## Acceptance criteria
- Mobile create has one live state owner per `/m/create/*` subtree.
- Drafts are preserved independently per workflow and per model.
- Switching models restores the exact draft previously used for that model.
- Local mobile media inputs no longer depend on `data:` URLs in `localStorage`.
- Reuse actions write the target draft before navigation.
- Safari and PWA model switching no longer depends on repair listeners.
- Mobile create screens do not instantiate isolated persistence logic independently.
- Desktop compatibility is preserved during the mobile-first rollout.

## Ticket breakdown
- ENGUI-151 covers store foundation, v2 schema, storage adapters, and migration.
- ENGUI-152 covers the route-scoped mobile provider and image-screen migration.
- ENGUI-153 covers atomic model switching and normalization.
- ENGUI-154 covers IndexedDB-backed media durability.
- ENGUI-155 covers store-first reuse transitions.
- ENGUI-156 covers video, TTS, and music mobile workflows.
- ENGUI-157 covers regression, QA, and legacy cleanup.
- ENGUI-158 covers optional desktop convergence.
