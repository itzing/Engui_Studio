# ENGUI-234 - Add Studio Session template LoRA controls and run management actions

## Summary
Extend Studio Sessions desktop workflows with three requested capabilities:
- add LoRA settings to Studio Session template generation settings, matching the Create Image experience for supported image models
- add run deletion
- ensure single-shot job launch is exposed and usable from the Studio Session run UI

## Status
Inbox

## Created
2026-05-06 22:10

## Labels
studio-sessions, desktop

## Depends on
- ENGUI-233

## Scope
- Reuse existing LoRA selection patterns/components where practical
- Persist LoRA settings in template draft/canonical state and carry them into shot execution payloads
- Add API + UI affordance for deleting a Studio Session run
- Verify single-shot launch UX from run detail cards

## Notes
User explicitly requested parity with Create Image LoRA settings for template-level generation defaults.
