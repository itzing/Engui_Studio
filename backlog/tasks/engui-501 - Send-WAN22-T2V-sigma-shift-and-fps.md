# engui-501 - Send WAN22 T2V sigma shift and FPS

Status: Done
Labels: [wan22, t2v, create-video, desktop, mobile]

## Goal

Expose `sigma_shift` and `fps` for the `wan22-t2v` Create Video model and include both fields in the RunPod payload.

## Scope

- Shared desktop/mobile Create Video form through the existing model parameter config.
- RunPod payload builder for `wan22-t2v`.
- Focused regression coverage.

## Notes

The endpoint branch is being prepared for SmoothMix T2V and will accept `sigma_shift` and `fps`.

## Result

- `wan22-t2v` exposes `Sigma shift` and `FPS` advanced controls in the shared desktop/mobile Create Video form.
- RunPod payloads for `wan22-t2v` include `sigma_shift` and `fps`.
- Defaults match the SmoothMix endpoint preparation: `steps=6`, `sigma_shift=8`, `fps=32`.
