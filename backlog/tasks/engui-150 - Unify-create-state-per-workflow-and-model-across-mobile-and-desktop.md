# ENGUI-150 - Unify create state per workflow and model across mobile and desktop

## Summary
Replace the current multi-instance create-state approach with a single shared draft store that preserves state per workflow and per model, applies model switches deterministically, and supports reuse targets like txt2img, img2img, and img2vid without losing model-specific parameters.

## Problem
The current mobile create flow mounts multiple independent `useImageCreateState()` instances across `/m/create`, `/m/create/model`, `/m/create/prompt`, `/m/create/advanced`, and `/m/create/scenes`.

That causes race conditions and stale state because:
- each screen owns local React state,
- each screen hydrates from storage independently,
- each screen persists independently,
- App Router route caching means multiple screens can coexist with stale in-memory state,
- Safari and iOS PWA standalone mode make route cache behavior even less predictable.

As a result, model changes are not reliably applied when returning from the model picker, and the behavior diverges between browser and PWA.

## Goals
1. One authoritative create-state instance per route tree session.
2. Preserve draft state per workflow and per model.
3. Switching from one model to another must restore the exact last draft for that target model.
4. Switching back must restore the exact last draft for the previous model.
5. Reuse actions (`txt2img`, `img2img`, `img2vid`) must populate the correct target workflow/model state including model-specific parameters and input assets.
6. The design should work for mobile first and be extensible to desktop with minimal duplication.

## Required behavior
### Per workflow and model persistence
For every workflow branch:
- `image`
- `video`
- `tts`
- `music`

store drafts keyed by model id.

Examples:
- `image/flux-krea`
- `image/z-image`
- `video/wan22`
- `tts/elevenlabs-tts`

If the user edits `z-image`, switches to `flux-krea`, and later switches back to `z-image`, the `z-image` draft must be restored exactly.

### Model-specific parameter integrity
Each model draft must preserve:
- prompt,
- randomize flag,
- parameter values,
- input asset references,
- scene selection,
- advanced-toggle state,
- any model-specific toggles like `use_controlnet`,
- any model-specific assets required for input visibility and reuse.

### Reuse coverage
The store must correctly support:
- `txt2img` reuse into image workflow,
- `img2img` reuse into image workflow with required image inputs/toggles,
- `img2vid` reuse into video workflow with correct target model defaults and required asset wiring.

The reuse pipeline must be able to write a complete target draft into the shared store before navigation.

## Recommended architecture
## 1. Introduce a shared create draft store layer
Create a single store abstraction that owns all create drafts, for example:
- `src/lib/create/createDraftStore.ts`

Responsibilities:
- load/save serialized state from localStorage,
- expose workflow active model,
- expose draft lookup by workflow+model,
- expose atomic update helpers,
- expose workflow/model switch helpers,
- expose reuse application helpers.

Suggested state shape:

```ts
export type CreateWorkflow = 'image' | 'video' | 'tts' | 'music';

export type DraftEnvelope<TDraft = any> = {
  modelId: string;
  updatedAt: number;
  draft: TDraft;
};

export type WorkflowDraftBucket = {
  activeModel?: string;
  drafts: Record<string, DraftEnvelope>;
};

export type UnifiedCreateDraftState = {
  version: 2;
  activeMode: CreateWorkflow;
  workflows: Record<CreateWorkflow, WorkflowDraftBucket>;
};
```

## 2. Add route-tree shared providers for mobile create
Create:
- `src/app/m/create/layout.tsx`
- `src/components/mobile/create/MobileCreateProvider.tsx`
- `src/components/mobile/create/useMobileCreate.ts`

This provider must be mounted once for the whole `/m/create/*` subtree.

That provider becomes the only live owner of mobile create state for the active workflow.

All mobile create screens must consume provider state instead of creating their own isolated `useImageCreateState()` instances.

## 3. Separate persistence from live state
Storage is for persistence only.

Do not use localStorage, events, `pageshow`, `focus`, or visibility handlers as the primary live synchronization mechanism between create screens.

Instead:
- provider loads once from store,
- provider mutates in memory,
- provider persists snapshots to storage,
- child screens read/write provider state only.

## 4. Make model switching transactional
Introduce an atomic workflow/model switch operation like:

```ts
switchWorkflowModel({
  workflow: 'image',
  nextModelId: 'z-image',
});
```

Behavior:
1. persist the current in-memory draft under the current workflow/model,
2. set `activeModel` for that workflow,
3. load existing draft for target model if present,
4. otherwise create normalized default draft for that model,
5. normalize parameter visibility/inputs for the target model,
6. publish the new provider state in one update.

This avoids partial transitions where UI and storage disagree.

## 5. Normalize defaults and model migration centrally
When a model becomes active, derive a normalized draft using a single function, for example:
- `normalizeDraftForModel(workflow, modelId, previousDraft?)`

Responsibilities:
- drop parameters that do not belong to the target model,
- initialize target-model defaults,
- preserve only compatible fields,
- enforce input visibility rules,
- preserve prompt where appropriate,
- clear incompatible media inputs,
- keep compatible shared fields like width/height if valid.

This is especially important for:
- `flux-krea -> z-image`
- `z-image(use_controlnet=true) -> flux-krea`
- `img2img -> txt2img`
- `image -> video (img2vid)`

## 6. Promote reuse into store-first actions
Instead of navigating first and hoping the target screen hydrates correctly, reuse should:
1. build a canonical target draft payload,
2. write it into the unified store,
3. set target workflow active model,
4. set active mode,
5. navigate.

For example:
- `applyReuseAction('txt2img', payload)`
- `applyReuseAction('img2img', payload)`
- `applyReuseAction('img2vid', payload)`

This guarantees the destination screen always opens with already-prepared state.

## 7. Make the solution reusable by desktop
Desktop can keep its current forms initially, but the store API should be universal so desktop can migrate later.

Target end-state:
- both mobile and desktop use the same underlying create draft store,
- mobile and desktop may have different providers or hooks,
- but they serialize the same workflow/model draft envelopes.

That gives us consistent behavior everywhere and removes duplicate persistence logic.

## Migration plan
### Phase 1 - Store foundation
- create unified store module,
- add versioned state v2,
- keep migration path from current `engui.create.state.v1` shape.

### Phase 2 - Mobile image provider
- add `/m/create/layout.tsx`,
- add mobile provider for image create,
- move image create live state out of `useImageCreateState()` into provider,
- convert mobile screens to provider consumers.

### Phase 3 - Model switch transaction
- implement atomic `switchModel` for image workflow,
- remove current pending-model/event/focus/pageshow hacks.

### Phase 4 - Reuse integration
- rework mobile reuse entrypoints to write complete target drafts into the store,
- verify txt2img/img2img/img2vid flows.

### Phase 5 - Extend to video/tts/music on mobile
- use the same provider/store pattern for other workflows,
- preserve drafts per model for each workflow.

### Phase 6 - Optional desktop convergence
- refactor desktop forms to use the same unified store contract.

## Acceptance criteria
### Core state behavior
- Selecting a model on mobile always applies immediately when returning to `/m/create`, in Safari and PWA.
- Switching between image models restores each model's last draft exactly.
- Drafts are preserved independently for every workflow and model.
- Route cache does not cause stale create state.

### Reuse behavior
- `txt2img` restores the image workflow with the expected model and compatible parameters.
- `img2img` restores the image workflow with required image assets and toggles such as `use_controlnet`.
- `img2vid` restores the video workflow with the correct target model, dimensions, and source image.

### UX behavior
- Prompt, seed mode, seed value, scenes, and media inputs remain stable across navigation between create sub-screens.
- Returning from model/prompt/advanced/scenes does not lose changes.

### Maintainability
- Mobile create screens no longer instantiate isolated persistence/hydration logic independently.
- Temporary sync hacks (`pending-image-model`, custom selection events, focus/pageshow repair logic) are removed.

## Recommendation
Implement this as a mobile-first shared-provider architecture backed by a universal workflow/model draft store.

Do not continue patching the current multi-instance hook design. It is fundamentally race-prone under cached navigation and will keep producing Safari/PWA-specific bugs.
