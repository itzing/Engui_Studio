# engui-503 - Flush mobile video draft on navigation

Status: Done
Labels: [create-video, mobile, drafts, wan22, t2v, bug]

## Goal

Preserve mobile Create Video settings when the user changes video parameters, opens Jobs, then returns to Create.

## Scope

- Shared `VideoGenerationForm`, with the fix covering mobile and tablet/desktop unmounts.
- Draft persistence for prompt, advanced state, parameter values, media previews, selected preset, and active video model.
- Focused regression coverage for unmount persistence.

## Notes

The form currently autosaves through a React effect after state updates. On mobile tab navigation, the route can unmount the form before the autosave effect flushes the latest values.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.

## Result

- `VideoGenerationForm` keeps a latest draft snapshot during render and flushes it on unmount, covering fast mobile navigation to Jobs.
- The unmount flush avoids overwriting externally updated draft storage when another path has already changed the same draft after the last autosave.
- Draft restore no longer gets overwritten by the parameter-default initialization effect after remount.
- Parameter edits now mark the draft restore as user-touched, preventing late async restore from replacing active edits.
