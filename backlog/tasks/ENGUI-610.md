# ENGUI-610 — Preserve hydrated LoRAs when cancelling mobile Advanced

## Status
In progress.

## Authorization and scope
Owner14872 reports A→B→A workspace switch, selected LoRAs visible, Cancel Advanced, reopen: selected LoRAs disappear. Fix mobile image Advanced Cancel; inspect shared desktop state for collateral regressions. No MCP/endpoint/model changes, no generation.

## Cause and approach
MobileAdvancedScreen captures editable parameters in mount effect before provider draft hydration. Cancel blindly restores that early empty snapshot (also omits dynamic slots beyond model schema). Record the pre-edit value only when a parameter is first edited, scoped to current workspace/model. Cancel rolls back only this screen's edits including dynamic LoRA paths/weights; untouched hydration and unrelated state are retained. Keep existing Save/autosave semantics.

## Verification and rollback
Reproduce before change with component tests; cover delayed hydration, no-edit Cancel, clear/add/reweight multiple/dynamic slots, Save, workspace isolation and remount. Relevant shared image draft/state regressions; actual Chromium/WebKit workspace switching, Cancel and reopening. Isolated production build, preserve prior build, commit/push/deploy when no active tasks; no paid generation. Roll back previous build if needed.

## Candidate verification
- Pre-fix failure reproduced in actual Chromium/WebKit after A→B→A switching; Cancel reset all selected LoRAs and other model parameters. Component reproduction:10failures/1pass before fix,11passes after.
-71 related tests passed across9files. Production build LOnpV1tu1VzphrS0EyK3E passed; no new TypeScript diagnostics relative to existing baseline.
- Browser regression covers Krea2 and Z-Image, phone/tablet, Chromium/WebKit:15checks per combination (120total), including no-edit Cancel, path/weight rollback, dynamic add, Save, workspace isolation and reload persistence. Only mocked APIs/local synthetic browser drafts; no generation.
- Rollout will preserve six already-submitted Z-Image provider Job IDs; these durable remote queued jobs are polled from database on process restart. No resubmission/cancellation, no endpoint changes. Restart guard rejects uploads, finalizations, unknown/in-flight submissions or local/MCP active operations.
