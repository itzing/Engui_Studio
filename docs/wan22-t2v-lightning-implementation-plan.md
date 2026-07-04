# Wan 2.2 T2V Lightning Implementation Plan

## Goal

Add a separate text-to-video Wan 2.2 model to Engui Create Video, backed by a separate RunPod endpoint built from the existing `wan22_Runpod_hub` repository.

The new model must be independent from the current Wan 2.2 I2V endpoint so that I2V remains stable and can be rolled back independently.

## Decisions

- Product model id: `wan22-t2v`.
- User-facing name: `Wan 2.2 T2V`.
- Endpoint repository: `/var/lib/openclaw/.openclaw/workspace/projects/engui-endpoints/wan22_Runpod_hub`.
- Endpoint branch: `wan22-t2v-lightning-v1`.
- No new endpoint repository.
- Engui surfaces: desktop Create Video and mobile Create Video.
- Live RunPod generation jobs are excluded unless explicitly approved.
- First model candidate: `lightx2v/Wan2.2-Lightning`, folder `Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V1.1`.
- First provider image tag: `itzing/wan22-t2v-models:v1`.
- First provider image digest: `sha256:5ff45f7b58261dae85f9492d816c82a4684226973a202ed5f1b5e9104b079875`.

## Model Choice

Use the LightX2V Wan 2.2 T2V A14B 4-step Lightning LoRA pair as the first implementation target:

- `Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V1.1/high_noise_model.safetensors`
- `Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V1.1/low_noise_model.safetensors`

Reasons:

- It is a Wan 2.2 T2V A14B Lightning pair, not an I2V pair.
- It ships with a Native ComfyUI workflow.
- The model card guidance matches a 4-step setup: CFG 1.0, Euler-style scheduling, time shift 5, and high/low distilled weights.
- Each Lightning LoRA file is around 1.23 GB, which is manageable for a provider image.

Alternative for later testing:

- `Wan2.2-T2V-A14B-4steps-lora-250928`
- This may improve motion, but the high file is around 2.45 GB. Keep it out of the first provider image unless the first live test shows a reason to switch.

Avoid for v1:

- `Wan2.2-T2V-A14B-4steps-250928-dyno`
- Its high file is around 28.6 GB, which makes it too heavy for the first fast endpoint iteration.

## Provider Image

Large immutable model files should live in a separate provider image so that RunPod endpoint builds do not download or copy 30+ GB repeatedly.

The first provider image should contain:

- `wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors`
- `wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors`
- LightX2V T2V Lightning V1.1 high LoRA
- LightX2V T2V Lightning V1.1 low LoRA
- Text encoder and VAE only if the existing runtime/model-provider images do not already provide compatible files

Expected paths inside the final endpoint image:

- `/ComfyUI/models/diffusion_models/wan2.2_t2v_high_noise_14B_fp8_scaled.safetensors`
- `/ComfyUI/models/diffusion_models/wan2.2_t2v_low_noise_14B_fp8_scaled.safetensors`
- `/ComfyUI/models/loras/Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V1.1/high_noise_model.safetensors`
- `/ComfyUI/models/loras/Wan2.2-T2V-A14B-4steps-lora-rank64-Seko-V1.1/low_noise_model.safetensors`

## Endpoint Work

Create branch `wan22-t2v-lightning-v1` from the current DaSiWa I2V branch or from a shared base that already contains the secure transport fixes.

Add:

- A backlog task `wan22-06`.
- A provider Dockerfile, for example `t2v-model-provider.Dockerfile`.
- A T2V workflow file, for example `wan22_t2v.json`.
- Handler support for a text-only mode without image inputs.

The T2V handler path must:

- Not require `media_inputs`.
- Not require role `source_image`.
- Load `wan22_t2v.json`.
- Preserve secure structured prompt transport.
- Preserve secure encrypted result transport.
- Use the existing cleanup behavior.
- Accept prompt, negative prompt, seed, width, height, length, steps, and cfg.
- Use the LightX2V workflow defaults: 4 steps, CFG 1.0, and the workflow's scheduler/time-shift settings.
- Keep the current I2V code path working for `wan22` if the branch still includes it.

The T2V workflow must not include:

- `LoadImage`
- `WanFirstLastFrameToVideo`
- Any start-image input

The initial v1 should bake the Lightning LoRA pair into the workflow rather than exposing it as a normal user-selected LoRA. This reduces user-facing complexity and avoids the earlier I2V problem where a speed LoRA was stacked on top of an already-distilled model.

## Engui Work

Add a new model config:

- `id: 'wan22-t2v'`
- `name: 'Wan 2.2 T2V'`
- `type: 'video'`
- `inputs: ['text']`
- `api.type: 'runpod'`
- `api.endpoint: 'wan22-t2v'`

Engui changes:

- Add a RunPod endpoint mapping key for `wan22-t2v`.
- Show `Wan 2.2 T2V` as a separate Create Video option on desktop and mobile.
- Do not show or require an image upload for `wan22-t2v`.
- Do not run the `WAN22_SOURCE_IMAGE_REQUIRED` validation for `wan22-t2v`.
- Add `wan22-t2v` to the secure transport model list.
- Add a RunPod payload builder for `wan22-t2v`.
- Reuse the `wan22-video` prompt helper profile unless a separate T2V helper profile becomes necessary.
- Keep existing `wan22` I2V behavior unchanged.

## Validation

Endpoint validation:

- `python3 -m py_compile handler.py`
- Parse all workflow JSON files.
- Assert `wan22_t2v.json` does not contain `LoadImage` or `WanFirstLastFrameToVideo`.
- Smoke-test handler prompt construction for T2V without `media_inputs`.
- Smoke-test that I2V still rejects missing `source_image` if that path remains active.
- Do not launch live RunPod jobs without explicit approval.

Provider image validation:

- Build provider image locally if practical.
- Verify expected model files exist in the provider image.
- Push provider image tag only after a successful build.

Engui validation:

- Type/build check with `npm run build`.
- Source checks:
  - `wan22-t2v` appears in model config.
  - `wan22-t2v` is included in RunPod settings endpoint mappings.
  - `wan22-t2v` is secure-enabled.
  - `wan22-t2v` does not trigger source-image-required validation.
- Restart `engui-studio.service`.
- Verify `/` and the mobile create route return HTTP 200.

## Rollback

Endpoint rollback:

- Revert the endpoint branch commits or switch RunPod endpoint back to the prior branch/image.
- If a provider image tag is wrong, stop using that tag and publish a corrected tag.

Engui rollback:

- Revert the Engui integration commit.
- Run production build.
- Restart `engui-studio.service`.

## Open Questions

- Whether the existing runtime/model-provider image already contains compatible text encoder and VAE files for T2V.
- Whether the first live T2V job works with LightX2V V1.1 quality and speed expectations.
- Whether `250928` should replace V1.1 after the first successful baseline test.
