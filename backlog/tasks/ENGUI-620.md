---
id: ENGUI-620
title: Connect Dataset Studio fork to secure Krea2 Identity Edit through Engui
status: Done
assignee: [OpenClaw]
created_date: '2026-11-26 17:45'
labels: [datasets, runpod, integration, krea2]
---

## Authorization and scope
Owner15031: create fork and proceed with reviewed integration. Fork https://github.com/itzing/lora-dataset-studio; pinned upstream v2 d376986. Preserve upstream catalog/Krea prompt wrapper/curation/caption/export. Current target25 accepted images; training separate. Noncommercial experiment explicitly confirmed. Owner15037 confirmed Dataset Studio UI + Engui backend only; no new Desktop/mobile/public MCP surface. Owner15041 deferred native RunPod Batch Jobs. Owner15043 authorized continuation. Ordinary /run jobs, no substitute native batch implementation.

## Plan
- Separate remote Krea engine in Studio with durable submit/status/cancel/restart/result lifecycle and scoped Engui connection; never masquerade as Comfy prompt IDs.
- Authenticated Engui bridge reusing existing workspace credentials, source uploads, immutable plans, durable dispatcher and encrypted transport. No global provider/encryption credentials in Studio.
- Explicit Identity Edit workflow in existing Krea2 worker, pinned node revision13ef60f20828949becada815d3cbc371eb5ccaab and author identity v1.2 adapter SHA2566adf9a69cc9502d286db7b69964d37da7e9cfe4b05b4d004bc275f087d3fd3cf. All assets baked in image; no model-cache disk.
- Count export reference deliberately to allow25 final pairs. Existing ordinary txt/i2i behavior preserved.
- Validate failure/restart/cancel/idempotency, auth/workspace isolation, original prompts, image integrity; bounded synthetic real worker smoke before promotion. No dataset batch or training without reference/curation.

## Recovery
Isolated branches: Studio engui-runpod; worker krea2-identity-edit; Engui feature/lds-krea-identity. Preserve previous app build and exact worker deployment before rollout. No worker quota changes. Run root /var/lib/openclaw/.openclaw/workspace/runs/lds-engui-integration-20261126; Engui checkout /home/engui/engui-runs/engui-620-20261126/src.

## Implementation progress
- Engui bridge committed and pushed to main: f6dd84e19bf31fea23b02ab78bd7284c5d1f2a86. Production build passed; 46 targeted tests passed; TypeScript diagnostics unchanged from baseline. Running production build not switched yet.
- Worker Identity Edit committed/pushed: b1f74b7f7be7b2cb0030950c75e5eba372a10345. Build 22743df2-f467-4ed4-a551-c38fd137c1a0 in progress. Image-only rollout + exactly one synthetic encrypted GPU test owned by lds-worker-rollout.service; no duplicate submission.
- Studio durable outbox, pinned reference/prompt, restart/retry/cancel, original transfer and exact25 export implemented. 39 focused backend tests, 46 Engui tests, 5192 core frontend tests passed and 1307 bundled frontend tests passed (10 bundled skips); final affected frontend checks47 pass; linters pass. Full backend comparison running against upstream; existing Windows-oriented trainer fixtures fail on Linux.
- Private Studio service installed at /home/engui/dataset-studio; HTTPS private tailnet port9443. Existing Showdown credential stored server-only; no new token. No training packages or models installed on host. Engui capability remains disabled until worker proof and app rollout.
- Native RunPod Batch, training launch, reference editing through Engui and transfer of Studio-local extra-LoRA presets remain outside this first lane.

## Delivered / qualification — 2026-11-26
- Studio fork branch engui-runpod: source a81741a, frontend bundle12252ea, with follow-up qualification documentation. Original catalog, prompt wrappers, curation and captions preserved; exact25 export excludes extra reference.
- Worker b1f74b7 built and installed on existing endpoint, min0/max5 and other settings unchanged. One stale worker-list record was verified EXITED via pod lifecycle and ignored; no worker or disk was deleted.
- Exactly one GPU proof df402c3d-54ce-4b04-8c31-1ea1f5075ed8-e1: 832x1216,8steps, encrypted source/result,12.032s execution,14.632s queue. Successful decryption and changed original; not a character-consistency quality claim. Only its two transport files deleted; local evidence retained.
- Engui main deployed at1e352f25c5acf4c6b3cc4883fbb07811638669fb, including corrected authenticated signed-link origin. Previous pre-feature and f6 builds retained in runroot for rollback. No active provider IDs changed.
- Installed Studio HTTPS https://massive.taild3a871.ts.net:9443/ (private Tailscale), dataset-studio.service5051. Existing Showdown token server-only; no new token. Installed bridge/upload/original SHA-256 check passed; its synthetic Gallery asset moved to Trash. Capability engines.engui_krea=true. No real dataset generated or training launched.
- Worker16CPU, Studio39focused +76finalcontracts, Engui48, frontend5192core+1307bundled/10skips passed; builds/lints passed, no new TypeScript diagnostics. Full Studio backend is NOT green on this Linux baseline: clean upstream11363pass/120fail/30errors/148skips before final stall interruption;136 remaining changed-run failures matched upstream exactly, two new contract issues fixed and covered in final76. Details docs/engui-validation.md.
- Browser automation was unavailable under navigation policy; no browser E2E claim. UI unit suites and installed HTTP checks passed. Captioning backend must be configured or captions entered manually. Native RunPod Batch and LoRA training remain deferred.
