# ENGUI-479 - Fix LoRA helper popover background and desktop position

Status: done
Created: 2026-07-29
Owner: Rocky

## Context

LoRA helper popovers are readable on mobile by placement, but their background can render transparent. On desktop, the helper popover appears near the picker corner instead of in the center of the viewport.

## Scope

- Give the LoRA helper popover an explicit solid background so notes and weight actions are readable on desktop and mobile.
- Keep the existing mobile button-anchored placement.
- Center the popover on desktop viewports.
- Preserve note-group click-to-copy and explicit pair weight apply behavior.

## Rollback

Revert the Engui commit, run `npm run build`, then restart `engui-studio.service`.

## Result

LoRA helper popovers now use explicit solid dark panel backgrounds for both normal and dark surfaces. Mobile keeps the existing button-anchored placement, while desktop viewports center the panel in the viewport. Added focused component coverage for the solid background and desktop-centered responsive classes.
