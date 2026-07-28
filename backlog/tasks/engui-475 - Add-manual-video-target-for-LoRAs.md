# ENGUI-475 - Add manual video target for LoRAs

Status: in_progress
Created: 2026-07-28
Owner: Rocky

## Context

WAN 2.2 video LoRA filtering currently treats only complete high/low pairs as video LoRAs. This hides valid video LoRAs that provide only one component, such as high-noise-only DaSiWa LoRAs. The DaSiWa endpoint workflow can accept a high-only dynamic LoRA, so the limitation is in Engui's catalog, picker, and submit path.

## Scope

- LoRA Manager: let users mark a LoRA file for video use.
- LoRA catalog: persist an optional manual target override per LoRA.
- LoRA filtering: keep the default rule, complete high/low pairs are video and standalone files are image, unless a manual override is set.
- Create Video: show manually video-marked incomplete high/low LoRAs in WAN video pickers and submit high-only or low-only `lora_pairs`.
- Surface: desktop and mobile Create share the same video form and picker.

## Rollback

Revert the Engui commit, run `npx prisma db push` to align the database schema, run `npm run build`, then restart `engui-studio.service`.
