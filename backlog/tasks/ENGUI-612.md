---
id: ENGUI-612
title: Krea2 Turbo image-to-image on desktop and MCP
status: In Progress
created_date: 2026-11-25
labels: [desktop, mcp, runpod, krea2]
---

## Scope
Owner14897: desktop + MCP only. Implement Krea2 latent i2i with one source image, denoise, existing LoRA stack and secure transport. Keep mobile UI text-to-image. No ControlNet/masked editing. Reuse baked weights; no network model disk or runtime weight downloads.

## Acceptance
- Dedicated Krea2 workflow uses correct model/encoder/VAE and encodes source at requested dimensions.
- Desktop mode/source/denoise, draft/reuse, seed and 8 LoRA slots work without T2I regression.
- MCP discovers capability, uploads/selects source, freezes and submits parameters; docs explain workflow.
- Encrypted inputs/results and correct LoRA wiring verified; real GPU smoke uses synthetic media.
- Build/test/deploy with rollback and no interruption of accepted jobs. Preserve current endpoint quotas.

## Rollback
Retain prior app build and endpoint template/image settings; restore both if validation fails.

## Validation progress
- Worker485632a pushed to the existing krea2 branch; managed RunPod build1bf810a9-3961-40f5-acad-b5178b10169f passed build and is uploading. Current installed image retained for rollback.
- 238 app tests pass (175 MCP,18 desktop/client,45 reuse) and7worker graph/LoRA tests pass.
- Chromium/WebKit52 checks pass, including source persistence/reload, Text/I2I, zero denoise, seed and LoRA. WebKit uses a persistent profile because ephemeral Playwright WebKit cannot store Blob in IndexedDB.
- Candidate HTTP21 checks pass; production build passes; no added normalized TypeScript diagnostics versus existing baseline.
- No paid GPU test submitted yet.
