# ENGUI-482 - Add WAN22 sigma shift slider

status: done
labels: [video, wan22, desktop, mobile, runpod]

## Context

Wan 2.2 I2V currently uses a fixed workflow `ModelSamplingSD3.shift` value of `5`.

## Acceptance Criteria

- [x] Desktop Create Video for `Wan 2.2` exposes a `Sigma shift` slider from `3` to `8`.
- [x] Mobile Create advanced settings exposes the same `Sigma shift` slider from `3` to `8`.
- [x] Wan 2.2 generation submissions include `sigma_shift`.
- [x] Existing default remains `5`.
- [x] Focused tests cover the model config and RunPod payload.

## Plan

See `docs/wan22-sigma-shift-slider-plan.md`.

## Result

Implemented a shared Wan 2.2 `sigma_shift` parameter with default `5`, range `3..8`, and slider rendering on desktop/mobile advanced Create surfaces. RunPod payloads now pass `sigma_shift` to the WAN22 endpoint.
