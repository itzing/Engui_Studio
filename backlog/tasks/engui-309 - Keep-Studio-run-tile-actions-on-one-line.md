# ENGUI-309 - Keep Studio run tile actions on one line

Status: done

## Request
Fit all desktop Studio run tile action icons into one horizontal row.

## Implementation
- Changed the shot action row to `flex-nowrap`.
- Reduced action button size from 32px to 28px.
- Reduced row padding and gap.
- Kept review actions and pose-change action visible in one row.

## Rollback
Revert the implementation commit and restart `engui-studio.service`.
