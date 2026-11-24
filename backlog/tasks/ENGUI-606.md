# ENGUI-606 — Secure Qwen 2511 MaskFlow endpoint and MCP

## Status

Done — deployed 2026-11-24, MCP 2.1.0.

## Scope

Owner 14809 authorized a separate endpoint repository and two worker slots reallocated from Krea2. Follow-up explicitly selected MCP + endpoint ONLY. No desktop/mobile changes. No custom Docker image build: published CUDA/PyTorch base plus pinned bootstrap. Dedicated `qwen-image-edit-maskflow` model, explicit source and mask (owned image or normalized rectangles), no primary Character. Ordinary Qwen, UI and historical plans are unchanged.

## Implementation

- Repository: https://github.com/itzing/qwen_image_edit_maskflow ; live handler revision `501930b4c36f7e1c641c420ab76cb8f3878adfaf`.
- Application implementation: `801feee`; production build `kMyr5ZT_dQBL6Mr96rzTZ`, previous build `aPQyza0XUGBg1YIvszSZq` retained.
- Authenticated/encrypted prompt, generation settings, source, mask and result; strict job/attempt/model/role bindings and scoped paths, no plaintext transport.
- Official pinned MaskFlow engine and latest scene adapter, 50 steps / CFG 4, no Lightning mixing. Mask geometry, hashes and ownership validated and rechecked before dispatch.
- Endpoint `dnc6cjeffpqwfy`, 96 GB GPU, 0 minimum / 2 maximum workers. Krea2 maximum reduced from 8 to 6; other limits unchanged. No active Krea job interrupted.
- 100 GB persistent model cache `ttw2b90u62` in US-NC-2. Existing encrypted S3 transport retained. Credentials remain outside Git.
- New setting only: `endpoints.qwen-image-edit-maskflow`; ordinary Qwen setting untouched. No database migration.

## Verification

- 19 endpoint CPU contract tests passed, including transparency and encrypted roundtrip.
- 191 application tests across 9 files passed, including 18 new MaskFlow integration checks and real TS-to-Python / Python-to-TS AES fixtures.
- Production build passed. Baseline and candidate have the same 125 existing TypeScript diagnostic locations; no new diagnostic locations.
- 22 candidate HTTP SDK checks and 10 public Showdown checks passed: discovery, required masks, frozen plan readback, defaults, plain/tag compatibility and removed Character selectors.
- One real synthetic secure GPU job completed: `18e625b4-68a6-466f-b733-4431a542b108-e2`. No user media. 512x512 encrypted output successfully decrypted; about 95 seconds execution plus 53 seconds queue delay. Far background was pixel-identical; an unwanted white shape appeared inside the editable region. Operational proof, not a quality guarantee.
- Synthetic GPU proof used handler `c6d5815`; later `501930b` only adds pre-inference transparent-mask rejection. Runtime/model/engine unchanged.
- Public MCP checks prepared two plans only; no extra paid job. Desktop/mobile model lists exclude MaskFlow.

## Evidence and rollback

Private application evidence: `/home/engui/engui-runs/engui-606-20261124`.
Private endpoint evidence: `/home/engui/engui-runs/qwen-maskflow-20261124`.
Application `previous.next`, `rollback.py` and `endpoint-setting.py rollback` preserve restoration of the previous build and newly added setting. Restart the service after restoring a build. Endpoint/Krea original configuration snapshots are private and contain credentials; never print or commit them. Restore quota in safe order (MaskFlow max 0 before Krea max 8) if rolling back.

Agent usage: `docs/qwen-maskflow-mcp.md` and discoverable `engui_get_prompt_guide`. Reconnect MCP to refresh tool schema; source and explicit mask are mandatory.
