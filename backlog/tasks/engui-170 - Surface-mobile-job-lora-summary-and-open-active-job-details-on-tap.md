# ENGUI-170 - Surface mobile job LoRA summary and open active job details on tap

## Summary
Add a compact LoRA summary to mobile job details and make tapping an active mobile job open its details screen directly.

## Acceptance criteria
- Mobile job details shows a short LoRA summary when LoRA inputs exist.
- Tapping an active mobile job (`queueing_up`, `queued`, `processing`, `finalizing`) opens `/m/jobs/[id]`.
- Existing completed-job viewer behavior remains intact.
- Build passes.
