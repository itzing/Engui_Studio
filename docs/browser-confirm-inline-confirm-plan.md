# Browser Confirm Inline Confirmation Plan

## Objective

Remove browser confirmation dialogs from local destructive actions on desktop and mobile surfaces, replacing them with existing inline confirmation button behavior.

## Approach

1. Generalize the existing inline delete confirmation button so it can show non-delete icons and labels while preserving current delete behavior.
2. Replace local `confirm()` guards for job cancellation, gallery trash deletion, S3 deletion, character trash, video sequence deletion, and pose/framing library delete actions.
3. Leave high-impact/budget confirmations as explicit dialogs or review flows for a later dedicated pass.

## Rollback

Revert the implementation commit, run `npm run build`, restart `engui-studio.service`, and smoke-test the main desktop and mobile routes.
