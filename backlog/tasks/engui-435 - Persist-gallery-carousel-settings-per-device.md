# ENGUI-435 - Persist gallery carousel settings per device

Status: in-progress
Created: 2026-07-23T06:48:06Z

## Request

Persist Gallery Carousel settings on the current device so reopening the carousel keeps the user's selected parameters.

## Scope

- Desktop Gallery Carousel controls.
- Mobile `/m/carousel` settings screen.
- Browser-local persistence keyed by workspace, preserving per-device behavior.
- Settings: Videos, Images, Landscape, Portrait, Speed, and Scrub.

## Acceptance

- Defaults remain Videos on, Images off, Landscape on, Portrait on, Speed 1.0x, Scrub 4x when no saved settings exist.
- Saved settings hydrate before loading the feed where possible.
- At least one of Videos/Images still remains enabled.
- Focused desktop/mobile carousel tests cover persistence.
