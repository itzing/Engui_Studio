# Wan 2.2 Sigma Shift Slider Plan

## Scope

Add a Wan 2.2 I2V sigma shift control to Create Video on desktop and mobile.

## Behavior

- Expose `Sigma shift` in advanced settings for model `wan22`.
- Use a slider range from `3` to `8`.
- Keep the current default at `5`.
- Submit the value as `sigma_shift` with Wan 2.2 RunPod jobs.
- Endpoint branch `dasiwa-i2v-lightspeed-v11` applies `sigma_shift` to both `ModelSamplingSD3` workflow nodes and clamps the accepted range to `3..8`.

## Validation

- Focused component/model config test for the slider metadata.
- RunPod payload test for `sigma_shift`.
- Secure generate route regression tests.
- Endpoint Python compile and structural workflow patch smoke.

