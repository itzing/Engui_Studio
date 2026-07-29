# ENGUI-480 - Add LoRA helper popover close and append actions

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

LoRA helper popovers can be opened from pickers, but they currently stay open after copying a prompt snippet and cannot be dismissed by clicking outside the popover. Users also need to add a new prompt snippet directly from the picker popover without returning to LoRA Manager.

## Scope

- Close the LoRA helper popover after a prompt snippet is copied.
- Close the popover when the user clicks outside it.
- Add a compact prompt snippet textarea/action inside the popover.
- Save appended snippets through the existing LoRA helper profile endpoint.
- Preserve the notes length limit and existing pair recommended weights.
- Keep user-facing UI text in English.

## Rollback

Revert the Engui commit, run `npm run build`, then restart `engui-studio.service`.

## Result

LoRA helper popovers now close after copying a prompt snippet and close when the user clicks outside the popover. The popover also includes an `Add prompt` textarea that appends a new prompt group to the current notes with a blank-line separator and saves it through the existing `/api/lora/helper-profile` endpoint while preserving pair recommended weights.
