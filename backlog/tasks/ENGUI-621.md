---
id: ENGUI-621
title: Preserve complete Dataset Studio references and clarify drawn-subject generation
status: Done
assignee: [OpenClaw]
created_date: '2026-11-26 20:45'
labels: [datasets, integration, bug, reference]
---

## Report and scope
Owner reported that an illustrated full-body character became unrelated photographic portraits. Existing Human prompt wrapper explicitly requests photography; the upstream default reference upload center-cropped the full-body image, removing the head. Remote transport faithfully pinned the wrong cropped reference. Scope: Dataset Studio only, no Engui/worker/model changes or paid tests.

## Repair
- Retain full frame by default; explicit auto-head-crop falls back to full frame when detection fails. Manual crop still honored.
- Show the complete reference thumbnail and explain drawn-subject mode and Krea single-reference limitation.
- Use the existing Anime catalog/identity lock for the affected drawn-character dataset. Keep upstream prompt recipes.
- Stop incorrect pending attempts, preserve completed originals and a private repair backup. Do not retry or rewrite historical snapshots.

## Validation and rollback
Regression: tall colored reference through upload to remote snapshot, drawn prompt not photographic, explicit manual crop still honored, failed auto detection keeps full frame. Targeted existing crop/HEIC/engine suites, lint, frontend build and installed HTTP checks. Roll back code via previous Studio release/files; reference and settings backed up outside the public repository.

## Delivered
Studio branch engui-runpod commits edbf281 (source) and b771eed (bundle), deployed to private Studio service. 65 focused backend checks, Ruff/ESLint and frontend production build passed. Installed HTTP upload retained both top and bottom of a 400x1024 fixture; only that temporary dataset was removed. HTTPS200. Existing manual crops remain respected. RunPod/Engui code and worker image unchanged. Incorrect old run settled15 cancelled/10 completed; all10 completed images retained. Existing dataset changed to drawn subject mode and original restored without rewriting historical snapshots. No new GPU jobs.
