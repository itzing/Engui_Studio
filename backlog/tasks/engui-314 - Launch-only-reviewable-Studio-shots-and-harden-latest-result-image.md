# ENGUI-314 - Launch only reviewable Studio shots and harden latest result image

Status: done

## Request
- When a shot job completes, the shot tile should show the newest version image reliably.
- `Launch run` should only start jobs for shots with no mark, `needs_retry`, `maybe`, or `reject`.
- Skip shots already marked as final good results (`pick`, `hero`).

## Scope
- Studio run launch filtering in `runAllStudioSessionShots`.
- Auto-select newest materialized version after job completion.
- Result tile image fallback/reload behavior for newly materialized versions.

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
