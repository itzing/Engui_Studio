# ENGUI-404 - Add original/resolved prompt tabs for reuse

status: done
labels: [create, gallery, jobs, mobile, desktop, prompt]

## Goal

Let users inspect both the authored prompt and the final resolved prompt in Job Details and Gallery Details, then send the selected version to txt2img reuse.

## Scope

- Desktop Job Details and Gallery Details.
- Mobile Job Details and Gallery Details.
- Show a compact `Original` / `Resolved` tab switch only when a resolved prompt exists and differs from the original prompt.
- Keep `Original` as the default tab.
- Send the selected prompt text to txt2img reuse.
- Keep existing behavior when a job or gallery asset has no resolved prompt.

## Notes

- The existing generation path already stores prompt metadata in job options and gallery generation snapshots.
- Reuse routes remain server-owned; clients pass the selected prompt as an explicit txt2img override.
- Implemented for desktop and mobile Job Details/Gallery Details.
