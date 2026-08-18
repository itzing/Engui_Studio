# engui-502 - Persist WAN22 T2V default video parameters

Status: Done
Labels: [wan22, t2v, create-video, desktop, mobile, bug]

## Goal

Fix Create Video so `wan22-t2v` saves full prompt and parameter state in drafts and presets, matching the existing image and I2V behavior.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Video draft restore/autosave.
- Video preset save and overwrite.
- Focused regression coverage.

## Notes

The current video form can save only edited `parameterValues`. For `wan22-t2v`, defaults such as width, height, seed, steps, sigma shift, FPS, and length may be visible in the UI through fallback values but absent from the saved draft or preset snapshot.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

- Video draft restore/autosave now merges model defaults into saved `parameterValues`.
- `wan22-t2v` presets are available in the shared Create Video form and save the full default parameter snapshot.
- Queued video job options now include the same complete parameter snapshot used by drafts and presets.
