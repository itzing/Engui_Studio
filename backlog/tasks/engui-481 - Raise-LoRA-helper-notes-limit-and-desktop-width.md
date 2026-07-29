# ENGUI-481 - Raise LoRA helper notes limit and desktop width

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

Some LoRAs have many useful trigger words and sample prompt variants. The current 1000 character helper notes limit is too small, and the desktop helper popover could use more horizontal room for longer snippets.

## Scope

- Raise the LoRA helper notes limit from 1000 to 8000 characters.
- Keep API validation, LoRA Manager, popover append validation, and tests aligned through one shared limit.
- Make the LoRA helper popover wider on desktop.
- Leave mobile width behavior unchanged for later optimization.

## Rollback

Revert the Engui commit, run `npm run build`, then restart `engui-studio.service`.

## Result

LoRA helper notes now use a shared `LORA_HELPER_NOTES_MAX_LENGTH` constant set to 8000 across API validation, LoRA Manager editing, popover append validation, counters, docs, and tests. The desktop helper popover width was increased to `min(42rem, calc(100vw - 2rem))`, while the mobile width remains unchanged.
