---
id: ENGUI-612
title: Krea2 Turbo image-to-image on desktop and MCP
status: Done
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

## Completed validation and deployment — 2026-11-25
- App implementation ee27807; worker b066b2a32da8ab0419967b1f4dab6bdbf42a6635 on the existing krea2 branch.
- 238 app checks and 10 worker checks passed. Production build t4Z8bh5vDpajt1uNsj6aW installed; previous build retained for rollback.
- Installed Chromium/WebKit: 52 checks passed across Krea2 and Z-Image. Public Showdown MCP 2.4: 21 HTTP checks passed, including upload → source → frozen i2i plan and original download, without additional generation.
- Real encrypted GPU test 8e2a01df-f076-4f36-b220-675554785c0d-e2 completed: synthetic 512×512, requested8steps, CFG1, denoise0.35, seed42, no LoRAs. Encrypted result decrypted successfully; pixels differ from source. Provider reported1261ms execution and443530ms queue delay. This is a transport/graph smoke test, not an instruction-following or quality benchmark.
- First test failed before inference due to a source path outside ComfyUI's allowed input root. Fixed by staging under the private RAM input directory with the image extension preserved; verified against the actual upstream validator. Second test was dispatched to a stale worker and failed before inference. With no Krea jobs active, the old fleet was drained and original0–5limits restored before the successful third test. No accepted user jobs cancelled or replayed.
- No model weights, persistent model disks or mobile mode UI added. Existing LoRA/transport mount retained. Deployment occurred with no active jobs/uploads.
- Local evidence: /home/engui/engui-runs/engui-612-20261125 and workspace/runs/engui-612-20261125. Synthetic ciphertext cleanup is recorded separately in cleanup-proof.json; local test receipts/results retained.
