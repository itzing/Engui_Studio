# Dataset Studio bridge

The experimental Dataset Studio fork uses its existing UI, shot catalog, Krea prompt wrappers, review and captions. Engui owns authorization, encrypted transport and ordinary RunPod generation. No new Desktop, mobile or public MCP tools are introduced. Native RunPod Batch Jobs are deferred.

## Enable

Deploy the Krea worker with the baked Identity Edit v1.2 adapter and pinned edit nodes first. Keep existing endpoint quotas and model availability policy. Set `ENGUI_DATASET_STUDIO_ENABLED=1` alongside `ENGUI_MCP_ENABLED=1`, then restart Engui. Rollback: remove the new flag and restore the previous app build/worker image if needed.

Studio connects server-to-server to `POST /api/dataset-studio` with an existing workspace-scoped bearer credential and `X-Workspace-Id`. The credential needs `read`, `generate` and `cancel`. Keep it on the Studio server, never in a browser bundle. A same-host installation may use a loopback origin; remote origins require HTTPS. The public MCP proxy does not need to expose this route for a same-host Studio.

## Contract

Actions: `capabilities`, `create_upload`, `get_upload`, `submit`, `status`, `cancel`, `artifact`. File links reuse the existing scoped, expiring MCP upload/download mechanism. Ordinary paid submit uses a stable candidate-attempt UUID. Retries of the same key recover the same plan/batch/job; changed payload is refused. Workspace and credential isolation, operator model policy, limits and revocation still apply.

Each candidate gets one existing internal generation plan/batch/variant and one ordinary provider job. Studio dispatches one remote candidate at a time and persists its outbox before HTTP; refreshing/restarting does not create another attempt. Explicit regeneration creates a new attempt. Unknown submission/cancellation results retain the original handle until resolved. No guarantee is made about RunPod keeping the same GPU worker warm.

Prompts arrive already composed by Studio and are passed literally, without a second Character, Vibe or wildcard expansion. Identity controls are carried inside the encrypted structured envelope; the encrypted reference uses `source_image`. Original output bytes, dimensions, length and SHA-256 are returned, never a resized preview. Existing text-to-image and image-to-image paths are unchanged.

This initial lane supports one active reference and the Krea identity controls. Studio-local extra-LoRA presets, reference editing, caption models and training are not automatically transferred to Engui. Dataset generation is not LoRA training. A technical smoke test does not establish character consistency; the owner reviews candidate images before exporting the final 25 image-caption pairs.


## Internal reference storage

Dataset Studio uploads use a separate credential/workspace-scoped receipt namespace and registered files under `uploads/dataset-studio`. They never create Gallery or Draft assets. The bridge returns an internal `dataset_upload` source, accepted only by the private Dataset Studio contract; public MCP media schemas and ordinary MCP imports are unchanged. Signed upload links bind the lane and honor bridge disablement. Workspace deletion collects registered files through the existing lifecycle.

A new private upload may reuse an old upload UUID without touching the old Gallery item or its Trash state. Accepted historical Gallery-backed plans remain immutable. Studio downloads original job output into its own dataset directory; this bridge does not save generation output into Gallery. Failed candidates require the user's explicit Retry; deployment never submits them automatically.
