# Krea2 regional LoRA (MCP 2.9)

ENGUI-623 adds optional regions to Krea2 Turbo text-to-image on the existing endpoint. Desktop/mobile UI and ordinary text/i2i/Dataset Identity Edit behavior are unchanged.

## Request
Discover the enabled model with engui_list_models and compatible LoRAs with engui_list_presets(kind=loras, modelId=krea2-turbo). Call engui_prepare_generation with modelId=krea2-turbo, mode=text_to_image, global prompt, explicit dimensions and seed, and regions. Each region contains prompt, loras=[{id,weight}], and mask.

- rectangles: mask={kind:"rectangles",regions:[{x:0,y:0,width:0.45,height:1}]}
- polygon: mask={kind:"polygon",points:[{x:0.55,y:0},{x:1,y:0},{x:1,y:1},{x:0.65,y:1}]}
- image: mask={kind:"image",source:SOURCE}, using the source returned by engui_create_upload/PUT/engui_get_upload or an owned Gallery/Job image.

Coordinates are normalized 0..1 in the full output canvas. Polygon vertices must be distinct, non-self-intersecting and nondegenerate, 3..64 vertices; closure is implicit. An image mask must be opaque grayscale, normalized orientation, and exactly output width/height. White applies the region's LoRA; black excludes it. Gray values soften adapter influence, but prompt attention uses a threshold. Rectangles are unioned (max32).

1..4 regions; at most8 adapter slots total, including top-level global adapters. CFG1, no negativePrompt/reference/denoise, 512..2048 in multiples of64, at most2MP. Every region needs1+ compatible LoRAs. A shared style LoRA can remain in top-level loras; do not duplicate a regional character LoRA there.

Keep permanent appearance in the selected Character card and reference it in the corresponding region's prompt with {character:UUID} or {character:UUID:withOutfit}. The global prompt describes scene, light and composition. Region prompts use the same Character/wildcard/seeded-alternative pipeline, independently and without duplicating the global Vibe. Masks guide adapter influence, not pose. Overlapping masks choose the strongest, with ties favoring earlier regions. No automatic segmentation/detailer is enabled.

## Plan, transport, workflow
Preparation never submits inference. Region text/Character snapshots, LoRA fingerprints and original/encoded mask hashes are frozen in the plan. Starting and dispatching revalidate them. Inspect snapshot.regions and snapshot.variants[].regions before an authorized start. Existing plans are not migrated or rewritten.

The internal prepared-only provider hook stages all adapters under existing workspace access checks and source-use leases, but splits globals from region adapters before encrypting. Regional prompts/LoRA file identities live in the authenticated structured payload; masks use distinct authenticated roles region_mask_0..3 and encrypted object storage. Python verifies generation/attempt/model/role binding, exact bytes, dimensions and grayscale before building the graph.

Pinned upstream: januspluto/ComfyUI-Krea2-Regional e88207aea47ccefc47605def2dc4f727e3e5f6c6. Low-level headless nodes Krea2LoRA -> Krea2RegionalPrompt -> Krea2ApplyRegional feed the existing Turbo sampler. Existing base weights/schedule are retained. Unmaskable layers are skipped, adaptive remapping is off, exclusive masks are enabled; shared image attention remains for scene coherence. This is beta regional routing, not an absolute likeness guarantee.

## Rollout and rollback
The worker image must be installed and technically verified before the application advertises the capability. Keep existing endpoint workers/GPU/scaling/mounts/env untouched. App deployment uses an isolated build, checks durable active provider handles, and retains the previous .next build. Rollback both previous endpoint image and app build if required.

Owner postponed testing the two real character LoRAs because the second is still training. Technical tests are not a claim of verified likeness on that pair.
