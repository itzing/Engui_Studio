# Z-Image I2I Create Image Implementation Plan

## Purpose

Add a first-class Image-to-Image mode to the desktop Create Image flow using the existing Z-Image RunPod endpoint architecture.

The goal is not to port the Reddit workflow one-to-one. Instead, implement a clean v1 I2I path based on the current Z-Image text/LoRA workflow:

- source/init image as generation base;
- current prompt, negative prompt, LoRA, seed, steps, and cfg behavior;
- explicit denoise control;
- secure prompt/LoRA/media transport consistent with the existing Z-Image contract;
- desktop Create Image UI mode selection: `Text | Control | I2I`.

## Non-goals for v1

- No SAM3 face-detail pass.
- No QwenVL node inside the RunPod workflow.
- No rgthree UI nodes in endpoint workflows.
- No combined I2I + ControlNet mode.
- No drag-and-drop input in v1.
- No automatic Gallery save.
- No paid/live Studio validation run without explicit approval.

## Key Decisions

### UI mode model

Replace the current ControlNet-style toggle with a single mode selector:

- `Text`
- `Control`
- `I2I`

`Control` and `I2I` both use image inputs, but they are different concepts and must not be visually mixed.

### I2I image semantics

In `I2I`, the image is only an init image.

There is no ControlNet/control image in I2I v1.

### Prompt extraction

I2I supports a button named `Extract prompt`.

Behavior:

- enabled only after a valid init image is loaded and previewable;
- uses the original/preview image, not the resized job copy;
- calls the existing local Vision Prompt Helper;
- replaces the positive prompt directly;
- does not modify negative prompt;
- does not append, draft, ask for confirmation, or offer undo;
- does not launch a job.

Current Vision Prompt Helper configuration:

- provider: `local`
- base URL: `http://127.0.0.1:8013`
- model: `Qwen2.5-VL-3B-Instruct-Q4_K_M`

### Prompt clearing

When a new init image is added or replaces the previous init image in `I2I` mode:

- clear the positive prompt immediately;
- keep negative prompt;
- keep LoRA selections;
- keep seed and generation settings.

This prompt clearing applies only to `I2I`, not to `Control`.

### Size model

I2I does not expose manual width/height fields.

Expose only:

- `Long side`
- default: `1536`

The source aspect ratio is preserved. Width/height are computed from the prepared job copy.

If the original image is smaller than the selected long side, upscale it for the job copy.

### Denoise model

Add I2I-only denoise control:

- slider;
- numeric value;
- presets styled like LoRA presets;
- no visible explanatory labels;
- hover tooltips on presets.

Preset values:

- `0.25`
- `0.35` default
- `0.50`
- `0.65`

Suggested tooltips:

- `0.25`: preserve source structure
- `0.35`: balanced redraw
- `0.50`: stronger redraw
- `0.65`: transform more

### Secure contract

Follow the current Z-Image secure contract.

Sensitive fields must not be sent in plaintext:

- prompt;
- negative prompt;
- LoRA list.

These continue to be carried through `_secure` as in current text generation.

Init image must be sent via the secure media input pipeline, not as raw base64 in the public job payload.

Open technical parameters may remain public as they are not sensitive by themselves:

- mode/task;
- width;
- height;
- seed;
- steps;
- cfg;
- denoise.

## Endpoint Plan

Repository:

```text
/var/lib/openclaw/.openclaw/workspace/projects/engui-endpoints/ZImage_runpod-zimage
```

### Workflow file

Create:

```text
workflow/z_image_i2i.json
```

Use the existing Z-Image workflow as the base. The workflow should support both no-LoRA and LoRA use through the existing dynamic LoRA chain, rather than static rgthree LoRA nodes.

Conceptual graph:

```text
LoadImage
→ VAEEncode
→ KSampler.latent_image
→ VAEDecode
→ SaveImage
```

Required behavior:

- load prepared init PNG;
- encode image through VAE;
- pass encoded latent into KSampler;
- use `denoise` on KSampler;
- decode and save image;
- keep Z-Image Turbo model/CLIP/VAE handling aligned with current endpoint workflows.

### Handler mode detection

Add I2I detection aliases:

- primary: `mode: "i2i"`
- alias: `task: "i2i"`
- alias: `task_type: "image_to_image"`

Normalize these into an internal `is_i2i` flag.

### Handler workflow selection

Workflow priority should be explicit and non-ambiguous:

1. OpenPose extraction mode;
2. I2I mode;
3. Control image mode;
4. LoRA text mode;
5. Plain text mode.

I2I must not accidentally select `z_image_control.json` just because an image exists.

### Handler inputs

I2I requires a source/init image.

Accepted sources should map onto the existing secure media and image input handling where possible:

- secure media input role: `source_image`, `init_image`, or `image`;
- legacy/public variants may be supported if consistent with existing endpoint behavior, but secure media is the UI path.

### Handler validation

For I2I:

- require init image;
- require prompt after secure decrypt/merge;
- default `denoise` to `0.35` if missing;
- clamp or validate denoise to a safe range, recommended `0.0 <= denoise <= 1.0`;
- use provided width/height from the prepared job copy.

### LoRA support

Use the current dynamic LoRA mechanism.

Do not add rgthree `Power Lora Loader` to endpoint workflows.

The same LoRA payload currently used by text generation should work for I2I.

### Endpoint examples

Add or update examples to document I2I secure usage.

The public payload should show only non-sensitive fields and secure media placeholders. Do not document plaintext prompt/LoRA as the preferred path.

## Engui Server Plan

Repository:

```text
/home/engui/Engui_Studio
```

### Init image lifecycle

When the user adds an init image through paste, file picker, or URL, the server creates an init image record/artifact and returns:

```json
{
  "initImageId": "...",
  "previewUrl": "...",
  "originalWidth": 1234,
  "originalHeight": 987
}
```

The browser should not keep relying on a large blob after upload. UI state should use `initImageId` plus preview metadata.

### Input sources

Support in v1:

- Ctrl+V paste image;
- file picker;
- URL.

URL behavior:

- URL is fetched by Engui first;
- Engui creates the same local init image artifact as paste/file;
- endpoint never depends directly on the external URL;
- endpoint receives only the prepared secure media copy.

### Temporary storage

Temporary I2I originals and prepared job copies have a TTL of 24 hours.

A cleanup mechanism should remove expired files and metadata.

### Prepared job copy

The original init image must not be modified.

On Generate, Engui prepares or retrieves a cached job-copy PNG:

- input: `initImageId`, `longSide`;
- output: prepared PNG path/reference, prepared width, prepared height;
- aspect ratio preserved;
- alpha composited onto white;
- long side equals selected `longSide`, default `1536`;
- upscales smaller originals if needed;
- output format: PNG.

### Job-copy cache

Cache prepared copies server-side by:

```text
initImageId + longSide
```

The following do not affect the image cache:

- prompt;
- negative prompt;
- denoise;
- LoRA;
- seed;
- steps;
- cfg.

If image or long side changes, the cache key changes.

### Generate flow

On Generate in I2I:

1. validate init image exists;
2. validate prompt is non-empty;
3. prepare or fetch cached PNG job copy;
4. compute width/height from prepared PNG;
5. create secure media input from the prepared copy;
6. submit Z-Image job with `mode: "i2i"`, width, height, denoise, and encrypted prompt/LoRA fields;
7. freeze submitted values in job metadata;
8. after submission, do not block UI for the already-running job; further edits apply to the next job.

### Extract prompt flow

`Extract prompt` should use the original/preview image, not the resized job copy.

The existing Vision Prompt Helper API may be extended to accept `initImageId`, or the I2I UI may resolve the init image to a server-side URL/data path and call the existing extract route. Implementation detail is flexible, but avoid sending large base64 blobs unnecessarily once `initImageId` exists.

## Create Image Desktop UI Plan

### Layout order in I2I mode

```text
Mode selector
Init image block
Extract prompt
Prompt
LoRA
Settings
Generate
```

### Init image block

Must be visually separate from the Control image block.

Labels should use I2I terminology:

- `Init image`
- not `ControlNet`
- not `Pose`
- not `Condition image`

Status text examples:

- `Preparing image…`
- `Ready · 1234×987`
- `Could not prepare image`

For v1, this status reflects the original upload/preview readiness. The resized job copy is prepared at Generate time.

### Invalid image state

If init image upload/preparation fails:

- keep preview visible if available;
- show error state;
- block Extract prompt and Generate until a valid init image exists.

### Mode switching

When switching between modes:

- keep prompt;
- keep negative prompt;
- keep LoRA;
- keep generation settings;
- keep I2I init image state hidden but not deleted;
- when returning to I2I, restore the init image state;
- submit only fields relevant to the active mode.

### Generate validation messages

In I2I:

- missing init image: `Init image is required for I2I`
- missing prompt: `Prompt is required for I2I`

### Job metadata

Persist I2I metadata with the job:

```json
{
  "i2i": {
    "initImageId": "...",
    "sourceType": "paste|file|url",
    "longSide": 1536,
    "denoise": 0.35,
    "sourcePreviewUrl": "...",
    "preparedWidth": 1024,
    "preparedHeight": 1536
  }
}
```

Do not store sensitive prompt/LoRA data outside the existing secure/history patterns.

### Job history UI

For v1:

- do not show source thumbnail in the main job card;
- show small source thumbnail in job detail/expanded view.

### Gallery behavior

Do not auto-save I2I results to Gallery.

Keep current behavior: results are saved to Gallery only manually through existing actions.

## Testing Plan

### Endpoint tests/checks

- Verify `z_image_i2i.json` loads in ComfyUI API format.
- Verify handler selects I2I workflow for:
  - `mode: "i2i"`
  - `task: "i2i"`
  - `task_type: "image_to_image"`
- Verify I2I does not select control workflow merely because a source image exists.
- Verify denoise is wired to KSampler.
- Verify dynamic LoRA chain still works in I2I.
- Verify missing init image returns a clear error.
- Verify secure prompt/LoRA behavior matches current text/LoRA flow.

Do not run paid/live endpoint jobs without explicit approval.

### Engui server tests/checks

- Paste/file upload creates `initImageId` and preview metadata.
- URL input is fetched and normalized into the same init image flow.
- Prepared PNG job-copy preserves aspect ratio and long side.
- Transparent PNG is composited on white.
- Prepared copy cache hits for same `initImageId + longSide`.
- Cache misses for different long side.
- TTL cleanup removes expired temporary files.

### UI tests/checks

- Mode selector shows `Text | Control | I2I`.
- Control and I2I image blocks are visually separate.
- Adding/replacing I2I init image clears positive prompt only.
- Extract prompt replaces positive prompt only.
- Long side default is `1536`.
- Denoise default is `0.35`.
- Denoise presets are available and tooltips work.
- Generate validates missing init image and missing prompt.
- Submitted I2I job includes metadata and secure media input.
- Job detail/expanded view shows source thumbnail.
- Gallery remains manual-only.

## Rollout Plan

1. Create local backlog tickets in `/home/engui/Engui_Studio/backlog` for endpoint, server, UI, and QA slices.
2. Implement endpoint I2I workflow and handler support.
3. Implement Engui init image storage, prepare/cache, and secure media submit integration.
4. Implement desktop Create Image UI changes.
5. Implement job metadata/history thumbnail support.
6. Run build and local validation.
7. Restart `engui-studio.service` after successful build.
8. Commit and push changes under the user Git identity.

## Open Implementation Notes

- Exact API route names for init image upload/prepare can be chosen during implementation; keep the behavior aligned with this plan.
- Prefer reusing existing secure media and generation submit infrastructure rather than introducing parallel transport.
- Keep all code comments and documentation in English.
- Keep mobile out of scope for this v1 unless explicitly requested.
