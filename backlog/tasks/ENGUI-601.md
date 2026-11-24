# ENGUI-601 — Live Character references in Create prompts

## Status
Done

## Request
Owner14732..14746 approved the design: Create Image and Create Video only, desktop/mobile. Support identity-only and identity plus current default outfit; Reuse loads the template and resolves current data. Prompts / Prompt Constructor must not expand these tags or change existing Characters behavior.

## Scope and design
- `{character:UUID}` inserts the current identity without clothing. `{character:UUID:withOutfit}` adds the current default outfit.
- Name-based character insertion and Include outfit control in the existing Create prompt editor. Shared server preview and submit resolution.
- Explicit opt-in from Create clients only; prepared MCP / Batch Cards, Studio and Prompt Constructor rendering remain unchanged.
- Workspace-bound lookup; immutable template, resolved prompt, character version and outfit revision metadata. Repeated references within a request use the same snapshot. Reuse keeps source tags, existing job retry uses its persisted payload.
- Preserve wildcard selection/seed behavior and support character tokens alongside wildcards; character descriptions are literal text, not recursively evaluated templates.
- Missing/deleted characters and unavailable requested default outfits fail before provider submission. If no default outfit exists, explain how to select one or use identity-only.
- No schema migration or paid generation for validation.

## Acceptance
- Both token modes insert and render correctly in desktop/mobile image/video Create.
- Current edits affect new renders and Reuse but not historical jobs.
- Cross-workspace, missing, malformed and deleted references fail before dispatch.
- Preview and generation share a resolver; previews do not advance saved wildcard cursors.
- Prompt Constructor is unchanged; excluded workflows do not opt in.
- Focused parser/resolver/UI/reuse and submission tests, Chromium/WebKit checks, isolated production build, commit/push, deployment and live smoke.

## Rollback
Retain the previous .next build before promotion. Restore it and restart engui-studio.service if required; revert the scoped feature commit. No database migration.

## Candidate validation
- 96 focused tests passed across 11 files, including isolated HTTP/DB tests of Krea2 and WAN T2V encrypted provider payloads, workspace rejection and Jobs/Gallery Reuse.
- Chromium and WebKit each passed 34 browser checks across desktop/mobile image/video Create. Generation requests were intercepted; preview used the real candidate resolver with synthetic data.
- Production build passed in isolated staging. Full type checking has the same normalized diagnostics as the baseline, no new diagnostics. An existing Prompt Constructor random-character test fails identically on the untouched baseline; the new literal-tag exclusion test passes.
- No live generation jobs or production fixtures were created. An early integration harness spy was reset by Vitest and sent requests using invalid fixture credentials/endpoints (404 only); the final harness mocks the provider module and forbids network fetches.
- Run artifacts: /home/engui/engui-runs/engui-601-20261124 and workspace runs/engui-character-tags-20261124.

## Deployment evidence (2026-11-24)
- Feature commit: `01106da`, pushed to origin/main. Live build: `vtKOsNLXh2Gwtwy5E4i2r`, promoted at 14:11:36 UTC; source/build input hashes match.
- Service active/running with zero automatic restarts. HTTPS Create, mobile Create, Prompt Constructor and referenced static assets returned 200.
- Installed UI passed 34 checks in Chromium and 34 in WebKit across desktop/mobile Create Image/Create Video. Fixture-only preview calls used the isolated server and generation requests were intercepted.
- Separate read-only live API checks passed: identity-only, current default outfit, exact provenance, missing-character 422, and cross-workspace rejection. Existing cards were not changed; no generation was launched. Active jobs remained zero.
- Previous serving build `mmNaSExIIdruz_nD0DWyd` retained at `/home/engui/engui-runs/engui-601-20261124/previous.next`, with rollback script and validation artifacts alongside it. No schema migration.
- Temporary isolated preview was stopped after validation. Existing untracked tmp/ remains untouched.
