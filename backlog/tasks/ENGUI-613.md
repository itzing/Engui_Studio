---
id: ENGUI-613
title: Fix secure Z-Image i2i input staging outside ComfyUI input root
status: Done
created_date: 2026-11-25
labels: [bug, runpod, z-image, mcp]
---

## Investigation
Owner14903 requested investigation of failed Z-Image jobs in Showdown. Four secure MCP i2i jobs failed on2026-11-25 between08:50 and08:52UTC, before the Krea2 release. Jobs3713748b,ee08a498,6a1a3097,1b15eefb; batches6635f67a and091871ad. All returned ComfyUI POST /prompt HTTP400 in251–339ms, before inference; same worker m8kznhssfcvixc.
Endpoint11eieingdqcycr uses registry.runpod.net/itzing-zimage-runpod-zimage-dockerfile:9945bdd44, branchzimage/commit9945bdd44f0f0f817066fdc9fb3bce9b84552830; min0,max1 unchanged.
Installed handler.py1085–1088 decrypts secure init_image to an absolute /task_uuid/condition_image.bin path; graph node61 LoadImage receives it at1231. Entrypoint configures ComfyUI input root /dev/shm/comfy-runtime/input. The input path is outside that root, reproducing the path validation defect fixed independently on the krea2 branch in b066b2a. Existing actual upstream LoadImage validator proof rejects old path and accepts private RAM input path. Current Z-Image handler discards HTTP400 node details; no per-node error was retained for these four original requests.

## Required correction
Port the private RAM input staging/extension and safe validation-error extraction fixes to zimage without changing its workflow/model/LoRA wiring. Cover secure i2i and shared source paths, cleanup and path boundaries. Build/publish the Z-Image worker, verify the actual active worker version, then validate an encrypted synthetic i2i round trip. Preserve endpoint max1/min0 and current jobs. Never automatically replay failed user jobs.

## Current disposition
Owner14907 authorized the fix. Worker-only correction, targeted checks, managed build and synthetic encrypted GPU verification; preserve max1/min0 and never replay failed user jobs. Old image/settings retained for rollback.


## Completed — 2026-11-25
- Worker fix8caec942aed84081ab5c264b1928eebd7ec6333c pushed to zimage. Private per-job Comfy input directory, secure MIME extension, copied legacy local sources, cleanup on success/failure, and safe HTTP400 node codes. Z-Image graphs, baked weights and LoRA topology unchanged.
-12 CPU regression checks passed, including actual AES-GCM input/output around mocked inference, eight LoRAs, i2i/Control/OpenPose source staging, invalid cipher and graph failure cleanup, source preservation, path boundaries and private-error reporting.
- Managed build0c58b383-d9d0-4fc3-abe7-bdcb48757d22 completed10:18:16UTC. Image registry.runpod.net/itzing-zimage-runpod-zimage-dockerfile_1203791377_38bd41d1af2797c4b1a1:8caec942a installed. Old pool drained only after confirming no active/queued Z-Image jobs. Original min0/max1/idle5 restored and all other settings preserved. Actual workers verified on version33/newimage.
- One real synthetic secure i2i job93356d93-8d62-4c00-9cd4-6cfb2692f063-e1 completed.512×512,9requestedsteps,CFG1,denoise0.35,seed42,noLoRAs. Result decrypted successfully; embedded workflow verifies actual Z-Image model, sampler settings and the corrected RAM input path. Output differs from input. Provider queue518440ms and execution823ms are separate; execution is not a pure inference benchmark.
- Original four failed Showdown jobs verified unchanged. No replay, deletion, or user-image generation. Only own synthetic ciphertext cleaned; evidence in /home/engui/engui-runs/engui-613-20261125.
- No Engui UI/MCP contract changes or app restart needed: the existing Z-Image endpoint ID is unchanged, so all callers receive the worker fix. Previous image/settings retained for rollback.
