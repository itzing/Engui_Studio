# Wan 2.2 T2V Additional LoRA Support Plan

## Goal

Expose optional high/low LoRA pairs for `wan22-t2v` while preserving the baked LightX2V Lightning pair that makes the T2V endpoint fast.

## Design

- Reuse the existing WAN22 `LoRAPairSelector` UI and `lora_high_*` / `lora_low_*` parameter names.
- Keep the baked Lightning pair internal to the endpoint workflow.
- Send additional LoRA pairs through the existing `lora_pairs` RunPod contract.
- Apply additional T2V LoRAs after the baked Lightning nodes in the endpoint graph.
- Keep weights on the shared freeform `-10..10` validation path.

## Surfaces

- Desktop Create Video.
- Mobile Create Video, via the shared video generation form.

## Endpoint Contract

`wan22-t2v` accepts the same optional `lora_pairs` shape as WAN22 I2V:

```json
[
  {
    "high": "high_lora.safetensors",
    "low": "low_lora.safetensors",
    "high_weight": 0.8,
    "low_weight": 0.8
  }
]
```

The endpoint chains these pairs after the baked T2V Lightning nodes:

- high path: `High UNET -> baked high Lightning LoRA -> additional high LoRA(s) -> High Noise Shift`
- low path: `Low UNET -> baked low Lightning LoRA -> additional low LoRA(s) -> Low Noise Shift`

## Validation

- Endpoint Python compile.
- Endpoint workflow JSON parse and T2V graph rewrite smoke.
- Focused Engui tests for model config and RunPod T2V payload.
- Focused Create Video LoRA weight regression test.
- Production build and service restart.

## Rollback

- Revert the endpoint commit and redeploy the previous endpoint image/branch if deployed.
- Revert the Engui commit.
- Run `npm run build`.
- Restart `engui-studio.service`.
