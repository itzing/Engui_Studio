# ENGUI-308 - Tighten Studio run shot tile grid

Status: done

## Request
Make desktop Studio run shot tiles denser, with minimal horizontal and vertical gaps between tiles.

## Implementation
- Added a dense `TileGrid` mode for run shots only.
- Dense run grid uses smaller tile minimum width and `gap-0`.
- Other Studio grids keep their existing spacing.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
