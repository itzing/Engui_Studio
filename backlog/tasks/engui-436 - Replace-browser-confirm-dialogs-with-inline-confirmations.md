# ENGUI-436 - Replace browser confirm dialogs with inline confirmations

Status: Done
Created: 2026-07-23T08:10:23Z
Finished: 2026-07-23T08:17:00Z

## Goal

Replace disruptive browser `confirm()` calls with inline confirmation controls on both desktop and mobile where the action is local to a toolbar, card, row, or detail panel.

## Scope

- Desktop Jobs actions: cancel single job, clear finished jobs, cancel all active jobs.
- Mobile Jobs actions: clear finished jobs, cancel single job.
- Job details cancel action.
- Gallery permanent delete and empty trash actions.
- S3 browser delete selected and delete current folder actions.
- Character move-to-trash action.
- Video sequence delete action.
- Studio pose/framing library delete actions for categories, poses, previews, presets, and preview assets.

## Out Of Scope

- Budget-spending launch confirmations.
- Wide import/replace confirmations.
- Unsaved navigation guards.
- Error-only `alert()` calls, which should move to toast or inline form errors in a separate pass.

## Validation

- Targeted ESLint on touched components: pass with existing warnings only.
- `git diff --check`: pass.
- `npx prisma validate`: pass.
- `npm run build`: pass.
- Production service restart and smoke checks after implementation.
