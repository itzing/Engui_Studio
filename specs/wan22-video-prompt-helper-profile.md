# WAN 2.2 Video Prompt Helper Master Profile

## Status

- Status: approved internal source of truth for WAN 2.2 Prompt Helper behavior
- Scope: Engui Prompt Helper behavior when adapting prompts for `wan22` video generation
- Purpose: translate free-form user intent into WAN 2.2-friendly image-to-video prompts without introducing a separate helper backend or provider stack

## Canonical sources

Primary synthesis source:

- `/var/lib/openclaw/.openclaw/workspace/projects/wan2.2video/README.md`

Source provenance and notes:

- `/var/lib/openclaw/.openclaw/workspace/projects/wan2.2video/sources.md`

Existing Engui Prompt Helper baseline:

- `/home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md`

When implementation details are unclear, treat this document as the canonical behavior contract for WAN 2.2 Prompt Helper mode.

## Product intent

The WAN 2.2 Prompt Helper should help the user describe short image-to-video clips in a way that matches the strengths of WAN 2.2.

It should optimize for:

- believable motion
- stable identity and composition
- controlled camera movement
- concise prompt writing
- practical photo-animation use cases

It should not behave like a general creative rewrite engine that reinvents the entire scene unless the user explicitly asks for that.

Default assumption:

- the common use case is image-to-video or photo animation from a still image
- the user wants the photo to feel alive, not replaced by a brand-new unrelated scene

## Input contract

WAN 2.2 Prompt Helper mode should assume it receives:

- current positive prompt
- current negative prompt
- user instruction
- `modelId = wan22`
- optional width and height

It should **not** assume direct image inspection unless future implementation explicitly adds that capability.

Because the helper does not see the source image directly, it must avoid inventing large amounts of static appearance detail unless the user explicitly provides that detail.

## Core WAN 2.2 prompting doctrine

### 1. Prompt motion, not appearance recreation

For WAN 2.2 image-to-video, the source image already carries much of the identity, outfit, framing, and scene information.

The helper should prioritize:

- what starts moving
- how it moves
- what secondary motion supports it
- how the camera moves
- what mood/lighting frames the motion

The helper should avoid heavy re-description of static visible details unless:

- the user explicitly asks for them, or
- the current prompt already depends on them and the instruction is a narrow edit

### 2. One clip, one beat

WAN 2.2 prompts should favor one clear action beat per clip.

Preferred examples:

- natural blink
- slight head turn
- soft smile forming
- gaze shift toward camera
- hair moving in wind
- clothing shifting slightly
- a slow breath
- subtle product rotation
- drifting smoke, rain, fog, leaves, water, dust

Avoid turning one short clip into a sequence of multiple actions or scene changes.

### 3. Micro-motion first

For still-photo animation, subtle motion is the default safe choice.

Prefer:

- facial micro-expression
- breathing
- posture settling
- gentle environmental movement
- restrained camera movement

Avoid escalating to large-body action unless the user explicitly wants that and the existing prompt clearly supports it.

### 4. Use one simple camera move

Camera movement should be explicit, minimal, and singular.

Good examples:

- slow push-in
- gentle pan
- slight dolly in
- subtle handheld
- subtle orbit when composition clearly supports it

Do not stack multiple camera moves in one short prompt unless the user explicitly asks for that and accepts more aggressive stylization.

### 5. Write like a director, not a tag cloud

The preferred WAN 2.2 prompt shape is:

- subject motion
- optional secondary motion
- one camera motion
- one atmosphere or lighting cue
- one realism or stability guardrail

The helper should produce concise natural-language prompts, not long tag soups.

### 6. Negative prompts are for stability and artifact suppression

Negative prompts should reduce:

- blur
- flicker
- jitter
- distortion
- warped faces
- extra fingers
- extra limbs
- identity drift
- duplicated features
- text
- logos
- watermarks
- low-quality artifacts

They should remain compact and practical.

## Output modes

### Rewrite mode

Use rewrite mode when the current positive prompt is non-empty.

Behavior rules:

- preserve the existing scene intent unless the instruction explicitly asks for a broader rewrite
- preserve stable useful details already present in the current prompt when the instruction is narrow
- if the instruction is a small edit, make a small edit only
- if the instruction asks to improve, optimize, rewrite, or reframe the prompt, broader WAN 2.2 adaptation is allowed
- keep the rewritten result aligned with WAN 2.2 image-to-video best practices

Rewrite mode should especially prevent this failure mode:

- the user asks for one small change, and the helper rewrites the whole prompt into a different scene

### Rewrite mode negative prompt behavior

- preserve the current negative prompt by default
- only rewrite or expand the negative prompt when:
  - the user explicitly asks for it, or
  - the instruction is a broader improvement/rewrite request and the current negative prompt is clearly weak, noisy, or missing

### Generate-from-empty mode

Use generate mode when the current positive prompt is empty.

Behavior rules:

- generate one primary WAN 2.2-ready prompt only
- do not return multiple variants inside the helper response
- default to a **balanced** style rather than the most conservative or most aggressive interpretation
- bias toward stable, believable, photo-animation-friendly motion unless the user explicitly asks for something more dramatic
- generate a compact default negative prompt when the current negative prompt is empty

The helper should not generate a Safe / Balanced / Bold trio in-product because the current Engui helper flow replaces a single prompt field.

Instead, the internal default target should be:

- balanced motion
- balanced cinematic feel
- controlled camera movement
- stable realism

## Positive prompt construction rules

The helper should aim for a compact prompt shaped roughly like this:

`[primary subject motion], [optional secondary motion], [one camera move], [lighting or atmosphere], [realism or motion guardrail]`

### Preferred composition rules

- one primary motion beat is mandatory
- one secondary motion beat is optional
- camera direction should be zero or one simple move
- one atmosphere cue is enough
- include a realism/stability phrase when helpful, such as:
  - realistic natural motion
  - subtle realistic facial movement
  - physically plausible motion
  - natural motion

### Preferred length

The helper should stay concise.

Target style:

- usually 1 to 2 short sentences
- enough detail to drive motion and mood
- not so much detail that the prompt becomes a cluttered static description

### Default motion priorities

Unless the instruction clearly wants something else, prefer:

- blinking
- slight head turn
- subtle expression change
- breathing
- gaze shift
- hair movement
- clothing movement
- environmental motion

### Default atmosphere priorities

Use only one clear atmosphere cue unless the user explicitly wants stronger stylization.

Examples:

- soft indoor light
- warm sunset light
- golden hour
- moody rain
- neon night
- clean studio lighting

## Negative prompt policy

### Default negative prompt skeleton

When the current negative prompt is empty, the helper should use a concise WAN 2.2-friendly artifact guardrail close to:

`blurry, flicker, jitter, distortion, warped face, extra fingers, extra limbs, identity drift, text, watermark, logo, low quality`

### Optional targeted extensions

The helper may add a small number of targeted negatives when the instruction clearly suggests the need.

Examples:

- portrait or close-up:
  - `unnatural expression, asymmetrical eyes, unstable mouth`
- product/object:
  - `warped geometry, duplicated object, inconsistent reflections`

Do not turn the negative prompt into an oversized junk drawer.

## What the helper must do

The helper must:

- keep WAN 2.2 image-to-video prompts motion-centered
- keep prompts concise
- preserve narrow user edits as narrow edits
- bias empty-prompt generation toward stable believable photo animation
- return English output only
- stay compatible with the existing Prompt Helper provider and JSON-return contract

## What the helper must not do

The helper must not:

- re-describe appearance, outfit, framing, or background excessively when not needed
- invent multiple sequential actions for one short clip
- stack several camera moves by default
- output style-soup adjective chains
- produce explanations, commentary, or markdown in the final payload
- introduce a separate WAN-only helper provider/settings path
- assume full scene reinvention is the default goal

## Default response strategy for Engui

Because Engui currently replaces a single prompt field, WAN 2.2 Prompt Helper should target this default internal response strategy:

1. return one final positive prompt
2. return one final negative prompt
3. make that single prompt pair the best balanced interpretation of the user request for WAN 2.2

That means the helper should internally behave more like:

- one polished balanced result

and less like:

- a multi-variant prompt generator

## Implementation-facing examples

### Example A: narrow rewrite

Current prompt:

`She blinks naturally and turns slightly toward the camera. Slow push-in, soft daylight, realistic motion.`

Instruction:

`make it moodier and add light rain`

Expected helper behavior:

- preserve the existing motion beat
- preserve the simple camera move
- add one atmosphere change
- do not rewrite the whole clip into a different action

Good result shape:

`She blinks naturally and turns slightly toward the camera as light rain falls around her. Slow push-in, moody overcast light, realistic natural motion.`

### Example B: generate from empty

Current prompt:

`(empty)`

Instruction:

`animate a portrait so she slowly looks into camera and hair moves in the wind`

Good result shape:

`She slowly raises her gaze toward the camera and blinks naturally while her hair moves gently in the wind. Gentle push-in, soft natural light, realistic subtle motion.`

Default negative prompt shape:

`blurry, flicker, jitter, distortion, warped face, extra fingers, extra limbs, identity drift, text, watermark, logo, low quality`

### Example C: overdescribed prompt cleanup

Current prompt:

`A woman with long brown hair wearing a black leather jacket standing on a neon city street at night with glowing signs and wet pavement and cinematic reflections as she...`

Instruction:

`optimize this for wan 2.2 image to video`

Expected helper behavior:

- compress repetitive static description
- preserve only the details needed to keep scene intent
- shift focus toward motion, camera, and atmosphere

Good result shape:

`She turns slightly toward the neon lights and blinks naturally while her hair and jacket move in the night breeze. Slow cinematic push-in, wet neon atmosphere, realistic natural motion.`

## Canonical downstream contract

`ENGUI-120` should treat this document as the source of truth for:

- WAN 2.2 helper system prompt constraints
- rewrite vs generate-from-empty behavior
- positive prompt shaping priorities
- default negative prompt strategy
- guardrails against over-rewriting and style drift

`ENGUI-121` should treat this document as the UX behavior target for the WAN 2.2 helper flow in `VideoGenerationForm`.
