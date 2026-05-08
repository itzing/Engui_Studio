# Studio Pose + Framing Library Implementation Plan

## Status

Draft v1 based on `docs/studio-frame-library-spec.md`.

Scope: desktop-first Studio Sessions integration for OpenPose-enhanced poses and run-level orientation-aware framing presets.

## Guiding principles

- Preserve existing text-only pose behavior.
- Do not require OpenPose data for every pose.
- Keep run creation centered around existing pose sets/categories.
- Add framing at run level, not per shot in v1.
- Store framing as aspect ratio + relative transform only; never store absolute pixel dimensions as preset source of truth.
- Server-side rendering of OpenPose control PNG is authoritative.
- Materialized runs/shots must remain stable after Pose/Framing Library edits.
- Desktop editor only in v1.

## Current endpoint assumptions

Z-Image endpoint branch `zimage` has been updated with:

- `task=openpose_extract` mode.
- OpenPose/DWPose PNG output.
- encrypted `pose_keypoint_encrypted` artifact.
- OpenPose ControlNet workflow consuming raw OpenPose PNG directly.
- `controlnet_strength` / `controlnetStrength` support.
- dynamic multi-LoRA support for ControlNet workflow.

Before starting Engui implementation, confirm deployed endpoint smoke:

1. `openpose_extract` returns encrypted OpenPose PNG + encrypted keypoints.
2. Z-Image ControlNet accepts rendered OpenPose PNG and respects layout.
3. ControlNet path still supports LoRAs and strength.

## Phase 0 — Backlog and prep

### Tasks

- Create local backlog tickets for each implementation phase.
- Confirm endpoint deployment is live and matches expected contract.
- Identify existing Studio pose fields, run settings, materialization task flow, and generation submit path.
- Decide storage directory for generated control images:
  - suggested: `public/generations/studio-framing-library` for previews;
  - job/materialization-specific path for run control images.

### Acceptance criteria

- Backlog tickets exist.
- Endpoint smoke result documented.
- Implementation order confirmed.

## Phase 1 — Prisma schema and domain types

### Database changes

Extend `StudioPose` with OpenPose fields:

```prisma
openPoseImageUrl       String?
poseKeypointEncryptedJson String?
openPoseSourceImageUrl String?
openPoseSourceJobId    String?
openPoseExtractedAt    DateTime?
```

Add `StudioFramingPreset`:

```prisma
model StudioFramingPreset {
  id          String   @id @default(uuid())
  workspaceId String

  title       String
  description String   @default("")
  tagsJson    String   @default("[]")

  orientation String
  aspectRatio Float

  centerX     Float
  centerY     Float
  poseHeight  Float
  rotationDeg Float   @default(0)
  flipX       Boolean @default(false)

  helperPrompt   String @default("")
  previewImageUrl String?

  sortOrder Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, orientation, sortOrder])
}
```

Extend Studio run/session model with framing policy fields. Use whatever existing run settings schema fits best, but target semantics:

```ts
framingPresetId?: string | null;
framingPresetByOrientation?: {
  portrait?: string | null;
  landscape?: string | null;
  square?: string | null;
} | null;
```

If existing run settings are JSON-based, store this in run settings/options first to reduce migration risk.

### Type changes

Add/extend shared types:

- `StudioFramingPresetSummary`
- `StudioFramingTransform`
- `StudioRunFramingPolicy`
- `StudioResolvedFramingSnapshot`
- OpenPose fields on `StudioPoseSummary` / pose detail summary.

### Acceptance criteria

- Prisma schema applies cleanly.
- Existing Studio routes still build.
- Existing pose library data remains valid.

### Validation

- `npx prisma validate`
- `npx prisma db push` after backup if DB migration is needed.
- Existing Studio util tests.

## Phase 2 — Server domain APIs for Framing Library

### Server module

Create or extend server module, e.g.:

`src/lib/studio-sessions/framingLibraryServer.ts`

Functions:

```ts
listStudioFramingPresets(input: {
  workspaceId: string;
  orientation?: StudioSessionPoseOrientation;
  query?: string;
}): Promise<StudioFramingPresetSummary[]>

getStudioFramingPreset(id: string): Promise<StudioFramingPresetSummary | null>

createStudioFramingPreset(workspaceId: string, input: Record<string, unknown>)

updateStudioFramingPreset(id: string, input: Record<string, unknown>)

deleteStudioFramingPreset(id: string)

duplicateStudioFramingPreset(id: string)

reorderStudioFramingPresets(workspaceId: string, ids: string[])
```

Normalization rules:

- `orientation`: `portrait | landscape | square`.
- `aspectRatio`:
  - default portrait `2 / 3`;
  - default landscape `3 / 2`;
  - default square `1`;
  - clamp to safe range, e.g. `0.25..4`.
- `centerX`, `centerY`: clamp `-0.5..1.5` to allow intentional off-canvas composition but prevent extreme accidents.
- `poseHeight`: clamp `0.05..2`.
- `rotationDeg`: normalize to `-180..180`.
- `tagsJson`: array of strings.

### API routes

Add routes:

- `GET /api/studio/framing-presets?workspaceId=&orientation=&query=`
- `POST /api/studio/framing-presets`
- `GET /api/studio/framing-presets/[id]`
- `PATCH /api/studio/framing-presets/[id]`
- `DELETE /api/studio/framing-presets/[id]`
- `POST /api/studio/framing-presets/[id]/duplicate`
- `POST /api/studio/framing-presets/reorder`

### Acceptance criteria

- CRUD works for framing presets.
- Presets never store pixel dimensions.
- Orientation/aspect defaults work.
- Delete does not affect existing materialized runs.

### Validation

- API smoke with curl.
- Unit tests for normalization if practical.

## Phase 3 — OpenPose extraction integration for Pose Library

### Server integration

Add pose-level extraction workflow functions:

```ts
queueStudioPoseOpenPoseExtraction(input: {
  workspaceId: string;
  poseId: string;
  sourceImageUrl?: string;
  sourcePreviewCandidateId?: string;
  sourceJobId?: string;
  openposeResolution?: number;
}): Promise<JobSummary>
```

Options:

1. Use existing generation job infrastructure with `modelId: 'z-image'` and `task: 'openpose_extract'`.
2. Add a `JobMaterializationTask` target type, e.g. `studio_pose_openpose_extract`, to attach output back to pose when job completes.

Recommended: use materialization task so extraction is asynchronous and consistent with existing pose preview materialization.

### Materialization behavior

When extraction job completes:

- decrypt/read OpenPose PNG output and store as pose control image asset.
- read/decrypt `pose_keypoint_encrypted` and store encrypted payload in `StudioPose.poseKeypointEncryptedJson`.
- set:
  - `openPoseImageUrl`
  - `poseKeypointEncryptedJson`
  - `openPoseSourceImageUrl` or `openPoseSourceJobId`
  - `openPoseExtractedAt`

Important: preserve encrypted keypoint payload. Do not accidentally log plaintext keypoints.

### Pose detail API/UI changes

Routes/actions:

- `POST /api/studio/pose-library/poses/[id]/openpose/extract`
- `DELETE /api/studio/pose-library/poses/[id]/openpose`

UI:

- Show OpenPose status.
- Show OpenPose PNG preview.
- Extract from uploaded/source image.
- Extract from selected preview candidate.
- Replace/Clear OpenPose data with confirmation.

### Acceptance criteria

- Existing text-only pose detail still works.
- Pose can attach OpenPose PNG + encrypted keypoints.
- Extraction from a preview candidate works.
- Clearing OpenPose data does not delete generated shot results.

### Validation

- Endpoint smoke against deployed endpoint.
- Pose detail smoke.
- Materialization inspection.

## Phase 4 — OpenPose keypoint renderer

### Purpose

Render exact-size OpenPose/DWPose control PNG from stored pose keypoints + framing transform + actual output dimensions.

### Module

Create:

`src/lib/studio-sessions/openPoseRenderer.ts`

Core function:

```ts
renderOpenPoseControlImage(input: {
  poseKeypointJson: unknown;
  width: number;
  height: number;
  transform: {
    centerX: number;
    centerY: number;
    poseHeight: number;
    rotationDeg: number;
    flipX: boolean;
  };
  outputPath?: string;
}): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}>;
```

Implementation notes:

- Start with server-side `canvas` package if already available or acceptable.
- If native canvas dependency is painful, use SVG rendering first:
  - generate SVG lines/circles;
  - convert to PNG via sharp if available;
  - or store SVG if endpoint accepts only PNG then convert.
- Use black background and OpenPose-style colored limbs/joints.
- Support body keypoints first; hands/face can be included after body works.
- Compute bbox from visible keypoints only.
- Ignore low-confidence/missing keypoints.

### Transform math

1. Extract visible keypoints.
2. Compute source bbox.
3. Move bbox center to origin.
4. Optional flip X.
5. Rotate by `rotationDeg`.
6. Scale so transformed bbox height equals `poseHeight * height`.
7. Translate to `(centerX * width, centerY * height)`.
8. Draw lines/joints.

### Acceptance criteria

- Given keypoints + framing preset, renderer creates PNG at requested dimensions.
- `aspectRatio` is not used as pixel source; only actual width/height are.
- Renderer can reproduce lower-left/top-third-empty style placement.

### Validation

- Unit tests for transform math.
- Generate sample PNG to inspect.

## Phase 5 — Framing Library UI

### Routes

Add desktop routes:

- `/studio-sessions/framing-library`
- `/studio-sessions/framing-library/frames/[framingPresetId]`

### Grid UI

Frame card shows:

- title;
- orientation + aspect ratio;
- helper prompt summary;
- transform summary;
- generic skeleton placement thumbnail.

Actions:

- create;
- edit;
- duplicate;
- delete;
- reorder;
- test with selected pose.

### Desktop editor

Implement an interactive 2D editor:

- canvas maintains `aspectRatio` visually.
- generic skeleton or selected pose skeleton preview.
- drag skeleton to update `centerX/centerY`.
- scale slider/handles update `poseHeight`.
- rotate 2D updates `rotationDeg`.
- flip X toggle.
- helper prompt textarea.
- orientation selector updates default aspect ratio unless user has manually changed ratio.
- aspect ratio control with presets:
  - portrait `2:3`;
  - landscape `3:2`;
  - square `1:1`;
  - custom numeric ratio.

### Acceptance criteria

- User can create and edit framing preset without pixel dimensions.
- Canvas preview matches saved relative transform.
- Desktop only; mobile can show read-only message or hide editor.

### Validation

- Manual UI test.
- API smoke after saving.

## Phase 6 — Run creation framing policy

### Run settings UI

In run creation/settings, add framing policy selector near pose set/category selection.

Modes:

1. `Default centered`
2. `Single preset for all orientations`
3. `By orientation`

By-orientation fields:

- portrait preset;
- landscape preset;
- square preset.

Fallback behavior:

```text
shot orientation
  -> orientation-specific preset
  -> single fallback preset
  -> default centered
```

### Data storage

Store in run settings/options:

```ts
interface StudioRunFramingPolicy {
  fallbackPresetId?: string | null;
  byOrientation?: {
    portrait?: string | null;
    landscape?: string | null;
    square?: string | null;
  } | null;
}
```

### Acceptance criteria

- Existing run creation still works with default centered framing.
- User can select one preset for all orientations.
- User can select orientation-specific presets.
- Run summary shows selected framing policy.

### Validation

- Create run with default.
- Create run with single preset.
- Create run with by-orientation policy.

## Phase 7 — Shot materialization and ControlNet generation

### Materialization changes

When launching/generating a shot:

1. Resolve shot pose as today.
2. Resolve shot orientation/output dimensions.
3. Resolve framing transform:
   - by orientation;
   - fallback;
   - default centered.
4. If pose has keypoints:
   - decrypt/parse keypoints;
   - render OpenPose PNG with exact dimensions;
   - attach as secure media input `condition_image`;
   - set `use_controlnet=true`;
   - set `controlnet_strength` from run/default settings;
   - include LoRAs normally.
5. If pose has no keypoints:
   - text-only flow;
   - append framing helper prompt.

### Prompt composition

Append concise framing helper:

```text
Composition: lower-left full body, top third empty background.
```

Do not rely on text helper for geometry when ControlNet PNG exists.

### Snapshot data

Run-level snapshot:

```ts
interface MaterializedRunFramingSnapshot {
  fallbackPresetId?: string | null;
  framingPresetByOrientation?: {
    portrait?: string | null;
    landscape?: string | null;
    square?: string | null;
  } | null;
}
```

Shot-level snapshot:

```ts
interface MaterializedShotPoseFramingSnapshot {
  resolvedOrientation: 'portrait' | 'landscape' | 'square';
  poseId: string;
  poseTitle: string;
  posePrompt: string;
  poseCameraAngle: string;
  hasOpenPoseControl: boolean;

  framingPresetId?: string | null;
  framingTitle: string;
  framingHelperPrompt: string;
  framingTransform: {
    aspectRatio: number;
    centerX: number;
    centerY: number;
    poseHeight: number;
    rotationDeg: number;
    flipX: boolean;
  };

  renderedControlImageUrl?: string | null;
  renderedControlImageWidth?: number | null;
  renderedControlImageHeight?: number | null;
}
```

### Acceptance criteria

- Text-only pose shots still launch.
- OpenPose-enhanced pose shots use ControlNet.
- Run-level framing applies consistently to all shots.
- Orientation-specific framing resolves correctly.
- Old materialized shots are not mutated by later library edits.

### Validation

- Dry/smoke without launching paid jobs where possible.
- Launch live jobs only with explicit user approval.

## Phase 8 — Preview generation

### Framing preview

Add preview generation for framing preset + pose combination:

- Select framing preset.
- Select pose with keypoints.
- Render control PNG.
- Live Z-Image ControlNet preview is intentionally deferred until the confirmation and budget UX is approved; current implementation must not launch paid preview jobs automatically.

### Pose preview extraction path

Support flow:

1. Generate or choose a pose preview image.
2. Extract OpenPose from it.
3. Attach OpenPose data back to pose.
4. Use it in framing/run ControlNet.

### Acceptance criteria

- User can create text pose → generate image → extract OpenPose → use it with framing.
- No bulk live jobs launch without explicit confirmation.

## Phase 9 — QA, docs, deploy

### QA checklist

- Existing Pose Library pages still work.
- Existing Studio run creation still works without framing.
- Text-only pose run works.
- Pose OpenPose extraction works.
- Framing Library CRUD works.
- Framing editor saves relative transform.
- Run with single framing preset materializes expected control PNG.
- Run with orientation-specific framing picks correct preset.
- Snapshot stability checked by editing pose/frame after materialization.
- Production build passes.
- Service restart succeeds.
- Smoke routes return 200.

### Validation commands

```bash
npm test -- tests/lib/studio-sessions-utils.test.ts
npm run build
sudo -n systemctl restart engui-studio.service
systemctl status engui-studio.service --no-pager
```

Smoke:

- `/studio-sessions`
- `/studio-sessions/pose-library`
- `/studio-sessions/framing-library`
- framing API list
- pose detail with OpenPose fields

### Commit/deploy

User preference: commit completed repo changes by default unless explicitly told not to. For Engui Studio, after changes:

1. build;
2. restart service;
3. smoke check;
4. commit;
5. push.

## Suggested backlog breakdown

1. Add OpenPose fields to Pose Library schema and types.
2. Add Framing Preset schema/domain/API.
3. Add OpenPose extraction materialization for poses.
4. Build OpenPose keypoint renderer.
5. Build Framing Library grid and CRUD UI.
6. Build desktop Framing Editor.
7. Add run-level framing policy selector.
8. Wire framing into shot materialization and Z-Image ControlNet generation.
9. Add preview/test flows for pose + framing.
10. Final QA/build/deploy/docs pass.

## Risks and open questions

- Exact `pose_keypoint_encrypted` response shape must be confirmed after deployed endpoint smoke.
- OpenPose keypoint schema from DWPreprocessor may need adapter code.
- Rendering hands/face from keypoints may be deferred if body-only is enough for v1.
- Native canvas dependency may complicate deployment; SVG/sharp fallback should be considered.
- ControlNet strength default should be configurable, likely run-level advanced setting.
- Aspect ratio and run resolution policy interaction must be tested carefully.
