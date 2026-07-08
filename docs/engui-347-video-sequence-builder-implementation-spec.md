# Desktop Video Sequence Builder Implementation Spec

## Status

Planning spec for `engui-347`.

## Problem

Longer AI videos are currently assembled manually from repeated single-shot image-to-video generations. A user starts with an image, generates a short WAN22 clip, extracts or finds the last frame, sends that frame into the next image-to-video job with a different prompt and LoRA setup, then repeats the process. This workflow works conceptually but is slow, fragile, and hard to reuse.

The new desktop workflow should treat a long video as a sequence of short generated segments. Each segment must preserve its input frame, generation settings, output video, extracted last frame, and lineage to adjacent segments. A successful segment should also be reusable as a template so future sequences can be assembled from known motion/prompt patterns.

## Goals

- Add a dedicated desktop Video Sequence Builder surface separate from the existing single-shot Create Video tab.
- Model a long video as an ordered set of generated segments.
- Use the previous segment's extracted last frame as the default input frame for the next segment.
- Allow each segment to use its own prompt, negative prompt, LoRA set, seed policy, duration, and WAN22 generation options.
- Preserve enough metadata to regenerate, fork, template, and audit every segment.
- Support saving any segment as a reusable Segment Template.
- Support assembling a new sequence from Segment Templates, while allowing local edits per segment.
- Support final rendering by concatenating already generated clips rather than regenerating the sequence.

## Non-Goals For The First Implementation

- Mobile UI.
- Multi-user collaboration.
- Full nonlinear video editing.
- Audio timeline editing.
- Inpainting/masking between segments.
- Live generation validation during implementation. Live RunPod jobs remain user-approved only.

## UX Model

### Top-Level Route

Route: `/video-sequences`

The route is desktop-first and should be reachable from the main Workspace header through a `Sequences` button placed immediately to the left of the existing `Gallery` button.

### Primary Layout

The page should use a dense production-tool layout rather than a marketing page.

- Left rail: template library and sequence list.
- Center: horizontal storyboard/timeline of segments.
- Right rail: selected segment inspector.
- Top toolbar: sequence-level actions.

### Center Storyboard

Each segment card should show:

- Segment index and status.
- Input frame thumbnail.
- Output video preview/poster.
- Extracted last frame thumbnail.
- Dependency indicator showing whether the input comes from the previous segment, a manual gallery/job frame, or a frozen uploaded frame.
- Stale indicator when upstream regeneration invalidates the current input frame.

Expected segment states:

- `draft`: no generation job submitted.
- `queued`: generation job created but not running.
- `processing`: generation job active.
- `completed`: output video and last frame are available.
- `failed`: generation failed; error available.
- `stale`: upstream source changed after this segment was generated.

### Segment Inspector

The inspector edits the selected segment.

Sections:

- Source: input frame source, thumbnail, source asset/job references, lock/freeze toggle.
- Prompt: positive prompt, negative prompt, optional continuity notes.
- Motion: camera/movement intent, action beat, duration.
- LoRA: WAN22 high/low pair selections and weights.
- Generation: model id, endpoint id, width, height, steps, guidance, seed, randomize seed.
- Output: output video, extracted first/last frames, generation job id, retry/regenerate controls.
- Template: save current segment as a template, update linked template, detach from template.

### Template Library

Segment Templates are reusable generation recipes, not rendered media.

Template fields:

- Name.
- Category.
- Prompt skeleton.
- Negative prompt skeleton.
- Motion intent.
- Continuity instructions.
- LoRA set and weights.
- Generation defaults.
- Variable definitions.
- Optional thumbnail/poster from the segment that created the template.

Template variables should use simple token syntax, for example:

- `{character}`
- `{setting}`
- `{emotion}`
- `{camera_motion}`
- `{action_beat}`

When a template is inserted into a sequence, it creates a segment draft with resolved defaults. The segment can then diverge from the template without mutating the original template.

## Data Model

Add new Prisma models instead of overloading `VideoProject`.

### `VideoSequence`

Stores the long-form sequence.

Fields:

- `id`
- `workspaceId`
- `title`
- `description`
- `status`: `draft | ready | rendering | rendered | failed`
- `aspectRatio`
- `width`
- `height`
- `targetFps`
- `defaultModelId`
- `defaultGenerationOptionsJson`
- `finalVideoUrl`
- `finalRenderJobId`
- `createdAt`
- `updatedAt`

Indexes:

- `(workspaceId, updatedAt desc)`
- `(workspaceId, status, updatedAt desc)`

### `VideoSequenceSegment`

Stores one generated clip in a sequence.

Fields:

- `id`
- `sequenceId`
- `orderIndex`
- `title`
- `status`: `draft | queued | processing | completed | failed | stale`
- `sourceMode`: `initial | previous_last_frame | gallery_asset | job_output | upload | manual_frame`
- `sourceImageUrl`
- `sourceImageAssetId`
- `sourceJobId`
- `sourceSegmentId`
- `sourceFrameRole`: `first | last | custom`
- `sourceFrozen`
- `prompt`
- `negativePrompt`
- `motionPrompt`
- `continuityPrompt`
- `modelId`
- `endpointId`
- `loraConfigJson`
- `generationOptionsJson`
- `seed`
- `randomizeSeed`
- `durationSeconds`
- `generationJobId`
- `outputVideoUrl`
- `firstFrameUrl`
- `lastFrameUrl`
- `templateId`
- `templateSnapshotJson`
- `generationSnapshotJson`
- `error`
- `createdAt`
- `updatedAt`

Indexes:

- `(sequenceId, orderIndex)`
- `(generationJobId)`
- `(templateId)`

### `VideoSegmentTemplate`

Stores reusable segment recipes.

Fields:

- `id`
- `workspaceId`
- `name`
- `category`
- `description`
- `promptTemplate`
- `negativePromptTemplate`
- `motionTemplate`
- `continuityTemplate`
- `variablesJson`
- `loraConfigJson`
- `generationOptionsJson`
- `defaultDurationSeconds`
- `thumbnailUrl`
- `sourceSegmentId`
- `createdAt`
- `updatedAt`

Indexes:

- `(workspaceId, category, updatedAt desc)`
- `(workspaceId, updatedAt desc)`

## API Design

### Sequence APIs

- `GET /api/video-sequences?workspaceId=...`
  - List sequences for a workspace.
- `POST /api/video-sequences`
  - Create a sequence.
- `GET /api/video-sequences/:id`
  - Return sequence with ordered segments.
- `PATCH /api/video-sequences/:id`
  - Update title, description, defaults, status.
- `DELETE /api/video-sequences/:id`
  - Delete sequence and optionally associated generated local files.

### Segment APIs

- `POST /api/video-sequences/:id/segments`
  - Add a draft segment.
- `PATCH /api/video-sequences/:id/segments/:segmentId`
  - Update prompt, LoRA, options, order, source settings, template link.
- `DELETE /api/video-sequences/:id/segments/:segmentId`
  - Remove a segment and reindex following segments.
- `POST /api/video-sequences/:id/segments/reorder`
  - Reorder segments.
- `POST /api/video-sequences/:id/segments/:segmentId/generate`
  - Submit a WAN22 image-to-video generation job for one segment.
- `POST /api/video-sequences/:id/generate-from`
  - Generate all draft/stale segments from a selected index forward.
- `POST /api/video-sequences/:id/segments/:segmentId/extract-frames`
  - Extract first/last frames from an existing output video.
- `POST /api/video-sequences/:id/segments/:segmentId/fork`
  - Duplicate a segment and its source settings into a new branch or adjacent draft.

### Template APIs

- `GET /api/video-segment-templates?workspaceId=...`
- `POST /api/video-segment-templates`
- `PATCH /api/video-segment-templates/:id`
- `DELETE /api/video-segment-templates/:id`
- `POST /api/video-sequences/:id/segments/:segmentId/save-template`
- `POST /api/video-sequences/:id/segments/from-template`

### Final Render APIs

- `POST /api/video-sequences/:id/render`
  - Concatenate completed segment clips into one final video.
- `GET /api/video-sequences/:id/render/status`
  - Poll render state.

The first render implementation can use server-side FFmpeg concat for completed local MP4 URLs. Remotion should remain available for later overlays, audio, and richer edits, but concat is the simplest reliable path for pure segment chaining.

## Generation Flow

### Single Segment Generation

1. Resolve the segment source frame.
2. Validate that the source frame exists and is an image.
3. Build a WAN22 image-to-video form payload from the segment settings.
4. Submit through the same generation path used by Create Video.
5. Store `generationJobId` and mark the segment `queued`.
6. When the job completes, attach `outputVideoUrl`.
7. Extract first and last frames with FFmpeg.
8. Store `firstFrameUrl`, `lastFrameUrl`, and `generationSnapshotJson`.
9. Mark the segment `completed`.
10. Mark downstream segments `stale` unless their `sourceFrozen` flag is true.

### Generate From Here

1. Start at selected segment.
2. Generate only segments that are `draft`, `failed`, or `stale`.
3. For each segment, wait until the previous required segment is `completed`.
4. Resolve source frames sequentially.
5. Stop on first hard failure and leave following segments unchanged.

This must be implemented as a server-side coordinator or durable queue task, not as a browser-only loop. Browser navigation should not lose generation progress.

## Frame Extraction

Frame extraction should be a shared server helper:

- Input: video file URL/path.
- Output: first frame URL, last frame URL, metadata such as width, height, duration, fps when available.
- Implementation: FFmpeg.
- Storage path: `public/generations/video-sequences/{workspaceId}/{sequenceId}/{segmentId}/`.

The helper should be usable by:

- Sequence segment completion.
- Manual "Extract last frame" action.
- Backfill/migration for older completed videos if needed.

## Staleness Rules

A segment becomes stale when:

- An upstream segment's `lastFrameUrl` changes and this segment uses `previous_last_frame`.
- The segment's linked template is updated and the segment has not been detached.
- Generation options change after output exists.
- LoRA configuration changes after output exists.

Stale segments should keep their existing output video visible. Staleness is a warning that the segment no longer matches its current source/settings, not an automatic deletion.

## Template Behavior

When saving a segment as a template:

- Copy prompt, negative prompt, motion prompt, continuity prompt.
- Copy LoRA configuration and generation options.
- Copy default duration.
- Store a thumbnail from the segment output if available.
- Store source segment id for traceability.

When inserting a template:

- Create a new `VideoSequenceSegment`.
- Resolve variables with sequence-level defaults when available.
- Store `templateId` and `templateSnapshotJson`.
- The segment can be edited independently after insertion.

## UI Phases

### Phase 1: Shell And Spec

- Add `/video-sequences`.
- Add desktop Workspace entry button.
- Show the planned three-pane Sequence Builder layout.
- Do not create database tables yet.

### Phase 2: Data Foundation

- Add Prisma models and migrations.
- Add sequence and template CRUD APIs.
- Add list/detail UI backed by real data.

### Phase 3: Segment Editing

- Add segment create/reorder/delete.
- Add source frame resolver.
- Add prompt, LoRA, and generation option inspector.
- Add template insert/save flows.

### Phase 4: Generation Chain

- Add single segment generation.
- Add frame extraction.
- Add downstream staleness propagation.
- Add "Generate from here".

### Phase 5: Final Render

- Add FFmpeg concat render.
- Store final render output on the sequence.
- Add render status and download/open actions.

### Phase 6: Polish And Recovery

- Add fork/branch flows.
- Add retry/failure recovery.
- Add backfill for last frames from existing gallery/job videos.
- Add keyboard shortcuts after core UX stabilizes.

## Validation Plan

### Unit Tests

- Source frame resolver.
- Template variable resolution.
- Segment reorder and reindexing.
- Staleness propagation.
- Generation payload builder.
- FFmpeg frame extraction path builder.

### API Tests

- Sequence CRUD.
- Segment CRUD.
- Template CRUD.
- Save segment as template.
- Insert segment from template.
- Generate segment rejects missing source frame.
- Render rejects incomplete sequences.

### UI Tests

- Workspace `Sequences` button links to `/video-sequences`.
- Sequence page renders shell.
- Segment selection updates inspector.
- Template insertion creates a draft segment after APIs exist.

### Manual QA

- Create sequence from gallery image.
- Generate first segment.
- Confirm last frame extraction.
- Generate next segment from previous last frame.
- Regenerate segment 1 and confirm segment 2 becomes stale.
- Save segment as template.
- Create a new sequence from templates.
- Render final concat.

## Open Questions

- Should sequences be visible in Gallery as collection-like assets, or only in the dedicated page?
- Should a final rendered sequence automatically be added to Gallery?
- Should templates be workspace-scoped only, or can they be global/user-scoped later?
- Should downstream stale segments be blocked from render, or allowed with a warning?
- Should "last frame" use the exact final frame or a configurable frame offset to avoid fade/corruption at the end?

## Recommended MVP

Build Phase 1 through Phase 4 first:

1. Dedicated route and shell.
2. Real sequence/segment/template persistence.
3. Segment generation with automatic last-frame extraction.
4. Save/use templates.
5. Generate from selected segment forward.

Final concat rendering can follow immediately after, but the core value is the chainable generation loop.
