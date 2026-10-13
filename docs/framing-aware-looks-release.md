# Framing-aware looks release
## Scope
Approved option 2, ENGUI-559–561. Shared deterministic region filtering for Characters and Studio, editable identity/outfit/custom parts, pose visibility, free preview prompt inspection, source freshness checks and pinned historical snapshots.
## Verification before deployment
- 49 focused tests pass: framing compiler, wardrobe, character preview prompt and Studio utility suites.
- Actual API/DB integration on a disposable migrated copy: 21 preview prompts (7 characters × 3 framings); real Studio revision assembly; mocked Krea2 launch serializes the exact filtered prompt and no OpenPose image; identity-only changes create versions; edits do not alter pinned runs; custom parts persist; foreign workspace access is rejected; changed pose framing invalidates controls; visibility exports correctly.
- Network calls were blocked except an explicit in-memory mock of the generation response. No new paid jobs.
- Migration run twice: first changes 7 characters, 7 outfits, 4 pose visibility records and 5 pristine draft snapshots; second changes zero records.
- Preservation verifier checks all 51 existing tables: prior character versions, previews, jobs, gallery assets, shot revisions/results, prompt documents and other-workspace rows retained.
- Desktop 1440×1000 and mobile 390×844 browser checks: prompt inspection, identity and wardrobe parts editing, no page overflow or browser exceptions; zero generation requests.
- Production-mode staging build passed. Dev mode exposed an existing instrumentation/Sharp edge-bundling failure; validation used production-mode staging with supervisor disabled and external network denied instead.
- Existing baseline: 6 failures in the old Studio server mock suite reproduce on unmodified a172c0b. Whole-repo TypeScript errors also reproduce on the baseline; no new error signatures in changed source. The repository build intentionally skips broad type/lint validation; focused tests and explicit baseline comparison are reported separately.
## Rollout
Deployed successfully at 2026-10-13 10:42 UTC. Runtime feature commit: e832af134ba6e23ce52da11685629579001e4a9a. Production build and explicit engui-studio.service restart passed. Live verification returned all 21 crop-specific prompts, zero new jobs, SQLite integrity OK and no foreign-key errors. Production backup: /home/engui/backups/framing-20261013/production-20261013-103717. Logs and test artifacts: /var/tmp/engui-framing-*.
Backups and rehearsal copies: /home/engui/backups/framing-20261013.
Historical executed runs stay unchanged. Start a new run from an existing session to use revised look metadata; five untouched compatible Showdown drafts are upgraded.

Additional Studio browser checks passed on desktop and mobile: pose visibility save and custom-outfit parts save/reload. Production preservation verified 8,822 gallery records, 96 Studio result versions, 78 shot revisions and all pre-existing character versions. Existing preview images were deliberately not regenerated.
