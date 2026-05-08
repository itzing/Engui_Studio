# ENGUI-305 - Redesign Studio run shot tiles

Status: done

## Request
Redesign the desktop Studio run panel so draft shot tiles become the primary review surface:

- Initially show draft tiles with pose preview when available; otherwise show the pose name.
- The image area in a draft tile must be square.
- The pose name such as `Lying 1` must be shown at the top-left of the image placeholder.
- Remove guide text entirely.
- Keep shot status and `Change pose`.
- When a draft's job completes, show the generated result in the same image placeholder.
- Show review controls on completed results: hero/star, pick/checkmark, maybe/~, reject/red cross, retry/circular arrows.
- Remove the separate result tiles below; draft tiles perform that function now.
- Continue tracking shot jobs and update the tile when completion arrives.
- If a shot has multiple results, show left/right navigation on that same item instead of adding another item.
- Clicking a result tile opens the existing viewer and can page through all result-bearing draft tiles.

Scope: desktop Studio Sessions run panel only.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
