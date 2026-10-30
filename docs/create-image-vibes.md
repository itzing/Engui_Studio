# Create Image Vibes

## Scope and behavior

Desktop and mobile image creation share a Vibe selector and Strip vibe controls. Existing desktop Vibes management remains unchanged. Selection is stored as an ID in each workspace/model image draft, outside the editable prompt. None disables it. The server looks up an active preset in the submitting workspace and prepends its exact description separated by a blank line before wildcard/variant expansion. Missing or trashed presets fail clearly instead of silently changing the requested image. Jobs retain the original prompt and Vibe snapshot in options so reuse restores separate fields without doubling the prefix.

Strip vibe is an explicit, independent text-helper operation, not automatic on selection or generation. It removes overall lighting, mood, atmosphere, color grading and emotional tone while preserving subjects, identities, poses, actions, body geometry, object colors/materials, setting, framing and literal facial expressions. It preserves template tokens. No regex/heuristic rewrite fallback. Invalid/truncated output, provider failures, edited prompts and changed context leave the current prompt intact. A successful cleanup can be undone. When a Prompt Constructor draft is selected, cleanup detaches a manual copy and does not edit the saved draft; Undo restores the link.

## Approach

Use the existing Vibes API for listing and a dedicated workspace-scoped strip endpoint using the same configured local text helper as extraction. Share a small UI/controller across both forms; keep desktop/mobile generation state owners and existing persistence architecture intact. Resolve Vibes at the server submission boundary to avoid stale client descriptions. Preserve all generation flows without Vibes and avoid new schema migrations.

## Verification and deployment

Test provider validation, stale cleanup/undo, selection persistence, reuse, server prefix ordering and source metadata with mocked external providers. Browser fixtures verify desktop/mobile layout and mocked submit payloads without launching real jobs. Build in an isolated source tree with ENGUI_ISOLATED_VALIDATION=1, keep the serving build intact until preview checks pass, retain previous.next, restart the service and repeat deployed checks. Commit/push using the owner identity.

## Verification

132 focused tests pass, including Vibe assembly/reuse, batch forwarding, cleanup validation, stale results, Undo and existing mobile behavior. The isolated production build passes. WebKit and Chromium each passed 16 dedicated desktop/mobile Vibe scenarios and 50 UI regression scenarios in preview and deployed HTTPS. Final preview screenshots confirm readable native select contrast and 320/390px hit targets. Each dedicated browser run simulated five generation submissions, local job persistence and helper responses entirely in memory; no real generation jobs or model-backed cleanup calls were launched. Read-only production checks found six active Vibes and a configured text helper. The deployed strip endpoint rejected an empty prompt with 400 before inference.

Service restarted at 2026-10-30 16:49:42 UTC and serves HTTP 200. Preview exited 0. Previous production build is retained at /home/engui/engui-runs/engui-576-20261030/previous.next. Full repository tsc remains non-clean on both baseline HEAD and candidate; normalized diagnostic comparison found zero added errors. Next production build skips the repository type/lint gate, so this is not a claim of a clean full-project typecheck. Physical iPhone and semantic quality of live LLM cleanup remain owner-side validation.
