# Mobile Jobs fullscreen Gallery and Draft toggles

## Scope

Phone fullscreen Jobs viewer only. Keep the existing Gallery and Draft icons after saving. Highlight active membership and expose aria-pressed plus action-specific labels: Remove job output from gallery / Remove output from drafts. Preserve normal add labels, existing upscale eligibility and all other viewer actions. No desktop/detail route changes.

## Implementation

Extract the two bucket controls into a focused component using the existing workspace-bound fetch and parent job-detail cache. Add via /api/gallery/assets/from-job-output. Remove via the existing reversible /api/gallery/assets/{id}/trash operation with trashed:true, targeting only unique IDs in the displayed output's selected bucket. Never fall back to a generic galleryAssetId and never delete jobs/files. Update confirmed IDs incrementally, so partial failures retain the still-saved state and allow retry. Disable both toggles during an operation and guard duplicate taps synchronously. Keep pending operations in the owning Jobs screen so hiding controls or switching slides cannot lose them or apply them to another job. Cancel remaining work and ignore callbacks when that screen unmounts. Reject stale detail-fetch responses after a confirmed cache update. Show short, noninteractive feedback immediately above the fullscreen controls. Cached output patches must preserve other bucket metadata and other outputs.

## Validation and deployment

Cover add/remove/re-add, common/draft isolation, duplicates and partial failures, request failure, busy state, missing IDs, unmount and image/video visibility. Browser fixtures intercept every API call and simulate mutations in memory only; verify fullscreen hit targets and persisted membership on reopen at phone widths. Preserve previous.next, build isolated with ENGUI_ISOLATED_VALIDATION=1, verify preview, swap and restart engui-studio.service, then validate deployed HTTPS. Roll back via previous.next and revert the feature commit if required. No real generation or gallery mutations in validation.

## Verification

103 focused tests and isolated production build pass. WebKit and Chromium each passed 50 scenarios in preview-final and deployed HTTPS, including independent Gallery/Draft remove/re-add, retained state on failures, busy buttons, image/video fullscreen, reopen/reload persistence, and a delayed detail response racing a confirmed removal. Each engine simulated 12 gallery mutations in memory; zero real API writes, unexpected API paths, page errors or generation jobs. Saved icons fit 320/390px and the 390px WebKit screenshot was visually inspected. Service restarted 2026-10-30 13:00:04 UTC. Preview exited 0. Previous build retained at /home/engui/engui-runs/engui-575-20261030/previous.next. Physical iPhone confirmation remains user-side.
