# ENGUI-478 - Add LoRA helper profiles

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

LoRAs often require trigger words, sample prompt snippets, and recommended WAN pair weights. These details are hard to remember and currently live outside Engui.

## Scope

- Surface: shared LoRA Manager, Create Image/Create Video desktop and mobile LoRA selectors, and desktop Video Sequences selected LoRA slots.
- Add persisted helper profiles for single LoRAs and complete high/low LoRA pairs.
- Store notes up to 1000 characters.
- Split notes by blank lines in helper popovers; clicking a note group copies it to the clipboard.
- For complete pairs, store recommended high and low weights.
- Show pair recommended weights and apply them to the current picker only after an explicit click.
- Do not auto-insert prompt text.
- Do not add recommended single LoRA weights.

## Rollback

Revert the Engui commit, run `npx prisma db push`, run `npm run build`, then restart `engui-studio.service`.

## Result

Implemented LoRA helper profiles with a new Prisma table and `/api/lora/helper-profile` save endpoint. `/api/lora` now serializes single and pair helper metadata with the catalog. LoRA Manager can edit notes for singles/pairs and recommended HIGH/LOW weights for complete pairs. Create Image/Create Video selectors show helper popovers; note blocks split by blank lines and copy on click; complete WAN pair weights apply only after an explicit click. Video Sequences selected LoRA slots expose the same helper popover and explicit weight apply action.
