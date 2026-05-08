# Studio Pose + Framing Library Spec

## Status

Draft v3 — desktop-first 2D OpenPose workflow for Studio Sessions.

## Core model

Keep the current Studio run model centered around pose categories / pose sets.

Add OpenPose as an enhancement to poses, and add a separate **Framing Library** that controls where the selected skeleton is placed in the output canvas.

Key decisions:

- **Pose** is still a pose.
- A pose can be text-only or OpenPose-enhanced.
- OpenPose is 2D and therefore includes the apparent view/camera angle as model guidance.
- **Framing** is a reusable canvas-placement preset.
- A Studio run selects one pose category/set as it does today.
- A Studio run may also select framing presets.
- Each shot picks/materializes its own pose from the selected pose category/set.
- Run-level framing can be a single preset or an orientation map (`portrait` / `landscape` / `square`).
- For each shot, Studio selects the framing preset matching the shot pose/output orientation.

This avoids per-shot assignment complexity while still allowing controlled composition.

## Terminology

### Pose

A pose describes what the subject body is doing.

It may include:

- text prompt;
- apparent view/camera angle metadata;
- OpenPose/DWPose PNG;
- encrypted keypoint JSON;
- source image/job metadata used for extraction.

OpenPose-enhanced pose means the model receives explicit 2D body structure. Since the control map is 2D, the pose also implicitly helps define apparent view angle.

Examples:

- `Standing contrapposto, front view`
- `Sitting side view`
- `Kneeling three-quarter view`
- `Back view over shoulder`

### Framing preset

A framing preset describes where a skeleton should sit inside the final image canvas.

It does not define body pose. It does not define pose category. It does not define output pixel dimensions.

It stores only relative placement/composition:

- orientation;
- aspect ratio;
- normalized skeleton center;
- normalized skeleton height;
- 2D rotation;
- flip X;
- helper prompt.

Examples:

- `Centered full body`
- `Lower-left full body, top third empty`
- `Small figure with large negative space`
- `Right-side portrait crop`

## Non-goals for v1

- Mobile editor UI.
- True 3D pose rotation.
- Per-shot frame assignment UI.
- Frame sequences or per-shot manual framing overrides.
- Removing existing text-only pose behavior.
- Requiring OpenPose for every pose.

## Data model draft

### StudioPose additions

```ts
interface StudioPose {
  // existing fields...
  title: string;
  posePrompt: string;
  cameraAngle: 'front' | 'three_quarter' | 'side' | 'back' | 'high' | 'low';

  openPoseImageUrl?: string | null;
  poseKeypointEncryptedJson?: string | null;
  openPoseSourceImageUrl?: string | null;
  openPoseSourceJobId?: string | null;
  openPoseExtractedAt?: Date | null;
}
```

Existing text-only poses remain valid.

### StudioFramingPreset

```ts
interface StudioFramingPreset {
  id: string;
  workspaceId: string;

  title: string;
  description: string;
  tags: string[];

  orientation: 'portrait' | 'landscape' | 'square';

  // Canvas aspect ratio, stored as width/height ratio, not pixels.
  // Defaults: portrait = 2/3, landscape = 3/2, square = 1.
  aspectRatio: number;

  centerX: number;      // 0..1 of canvas width
  centerY: number;      // 0..1 of canvas height
  poseHeight: number;   // skeleton height as fraction of canvas height
  rotationDeg: number;  // 2D rotation only
  flipX: boolean;

  helperPrompt: string;
  previewImageUrl?: string | null;

  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

No absolute pixel dimensions are stored. Actual dimensions are derived from run generation settings. `aspectRatio` is stored only to render the editor canvas and to select/derive a compatible generation shape. Default ratios are `2:3` for portrait, `3:2` for landscape, and `1:1` for square.

### StudioRun addition

```ts
interface StudioRun {
  // existing fields...
  poseSetId: string | null;
  framingPresetId?: string | null;
}
```

The run-level framing preset applies to every shot in the run.

## Run creation behavior

Current flow:

1. User chooses pose category/set.
2. User chooses shot count.
3. Studio creates shot slots and picks poses from that category/set.

New v1 flow:

1. User chooses pose category/set.
2. User optionally chooses framing presets:
   - a single fallback framing preset; or
   - orientation-specific presets for portrait / landscape / square.
3. User chooses shot count.
4. Studio creates shot slots as before.
5. Each shot gets a pose from the selected pose set.
6. Each shot resolves framing by its orientation:
   - exact orientation-specific preset;
   - fallback preset;
   - default centered framing.

If no framing preset is selected, Studio uses default centered framing.

## Generation behavior

For each shot in a run:

1. Load the shot's materialized pose.
2. Resolve shot/output orientation.
3. Load the run-level framing preset for that orientation, fallback preset, or default framing.
4. Resolve output dimensions from generation settings and resolved orientation.
5. If the pose has OpenPose keypoints:
   - render exact-size OpenPose PNG using the framing transform;
   - send it as `condition_image` to Z-Image ControlNet;
   - append framing `helperPrompt` to prompt.
6. If the pose has no OpenPose keypoints:
   - use existing text-only pose prompt flow;
   - append framing `helperPrompt` as text guidance.

This means framing is always run-scoped, while poses remain shot-specific.

## Default framing

If no framing preset is selected:

```json
{
  "title": "Default centered",
  "orientation": "portrait",
  "aspectRatio": 0.6666667,
  "centerX": 0.5,
  "centerY": 0.58,
  "poseHeight": 0.78,
  "rotationDeg": 0,
  "flipX": false,
  "helperPrompt": "centered full-body composition"
}
```

Default framing is available for every orientation. Defaults use portrait `2:3`, landscape `3:2`, and square `1:1`. The actual orientation follows the shot/run resolution policy; if an orientation-specific framing preset exists, its `aspectRatio` is used to render the editor preview and derive a compatible output canvas.

## Rendering model

Server-side rendering is authoritative.

Input:

- pose keypoints;
- framing preset transform;
- actual output width/height derived from orientation + aspect ratio.

Steps:

1. Decrypt/parse pose keypoints.
2. Compute skeleton bounding box from source keypoints.
3. Normalize keypoints around bbox center.
4. Apply framing transform:
   - flip X;
   - rotate in 2D image plane;
   - scale to `poseHeight * canvasHeight`;
   - translate bbox center to `(centerX * canvasWidth, centerY * canvasHeight)`.
5. Render OpenPose PNG at exact output dimensions.
6. Send PNG as `condition_image`.

## Endpoint contract

### Extract pose from image

```json
{
  "task": "openpose_extract",
  "source_image": "...",
  "openpose_resolution": 1024,
  "detect_body": true,
  "detect_hand": true,
  "detect_face": true
}
```

Expected response:

- encrypted OpenPose PNG;
- `pose_keypoint_encrypted` JSON artifact.

### Generate with OpenPose ControlNet

```json
{
  "prompt": "...",
  "condition_image": "...rendered openpose png...",
  "controlnet_strength": 1.0,
  "lora": [["model.safetensors", 0.8]],
  "width": 1024,
  "height": 1536
}
```

Endpoint consumes OpenPose PNG directly, without Canny.

## UI v1 — desktop only

### Pose Library additions

On pose detail:

- show whether OpenPose data exists;
- show OpenPose PNG preview;
- actions:
  - extract OpenPose from uploaded/source image;
  - extract OpenPose from selected generated preview;
  - replace OpenPose data;
  - clear OpenPose data.

### Framing Library

New route:

- `/studio-sessions/framing-library`
- `/studio-sessions/framing-library/frames/[framingPresetId]`

Framing grid shows:

- title;
- orientation;
- helper prompt summary;
- placement preview with generic/sample skeleton;
- tags.

Actions:

- create framing preset;
- edit placement;
- duplicate;
- delete;
- test with selected pose.

### 2D Framing Editor

Desktop editor features:

- choose orientation;
- choose/edit aspect ratio, defaulting to portrait 2:3, landscape 3:2, square 1:1;
- preview with generic skeleton or selected pose skeleton;
- drag skeleton placement;
- scale;
- rotate 2D;
- flip X;
- edit helper prompt;
- save preset.

Only relative transform values are stored.

### Run creation UI

Add framing selector near pose set/category selection:

```text
Pose set: Standing
Framing mode: By orientation
Portrait: Lower-left full body
Landscape: Centered wide body
Square: Default centered
Shots: 12
```

Framing selector states:

- `Default centered`;
- `Single preset for all orientations`;
- `By orientation` with portrait / landscape / square slots;
- optional `Preview framing` button.

No per-shot framing assignment in v1.

## Snapshot rules

Materialized run/shot must snapshot enough data to reproduce old generations after library edits.

Run-level snapshot:

```ts
interface MaterializedRunFramingSnapshot {
  framingPresetId?: string | null;
  framingPresetByOrientation?: {
    portrait?: string | null;
    landscape?: string | null;
    square?: string | null;
  } | null;
}

interface MaterializedShotFramingSnapshot {
  resolvedOrientation: 'portrait' | 'landscape' | 'square';
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
}
```

Shot-level snapshot:

```ts
interface MaterializedShotPoseSnapshot {
  poseId: string;
  poseTitle: string;
  posePrompt: string;
  poseCameraAngle: string;
  poseKeypointEncryptedJson?: string | null;
  renderedControlImageUrl?: string | null;
  renderedControlImageWidth?: number | null;
  renderedControlImageHeight?: number | null;
}
```

Later edits to Pose Library or Framing Library must not mutate existing materialized runs/shots.

## Acceptance criteria v1

- Existing text-only pose set run creation still works.
- Run creation can optionally select framing presets.
- Framing can be a single fallback preset or orientation-specific portrait/landscape/square presets.
- Each shot resolves framing from its orientation, then fallback, then default centered.
- Each shot still gets its own pose from the selected pose set.
- Poses can be enhanced with OpenPose PNG + encrypted keypoints.
- Framing stores aspect ratio plus relative 2D placement/composition, no pixel dimensions.
- Desktop framing editor can move, scale, rotate 2D, and flip skeleton placement.
- Server renders exact-size OpenPose PNG from shot pose keypoints + run framing + run resolution.
- Studio generation sends rendered OpenPose PNG to Z-Image ControlNet when keypoints exist.
- Text-only poses fall back gracefully.
- Materialized runs/shots remain stable after pose/framing edits.
