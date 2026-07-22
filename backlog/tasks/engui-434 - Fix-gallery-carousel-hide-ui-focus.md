# ENGUI-434 - Fix Gallery carousel Hide UI focus

status: done
labels: [gallery, desktop, carousel, keyboard, controls]

## Goal

After pressing `Hide UI` in the desktop Gallery Carousel, keyboard controls must keep working immediately.

## Scope

- Move keyboard focus out of the hidden controls when the user hides the UI.
- Preserve Space pause/resume.
- Preserve ArrowLeft/ArrowRight held scrubbing.
- Preserve `H` hide/reveal and pointer reveal behavior.
- Keep the fix scoped to the shared desktop carousel component.

## Validation

- Add focused component regression coverage for `Hide UI` followed by Space and ArrowRight.
- Run the focused carousel tests.
- Run targeted lint for touched files.
- Run production build, restart `engui-studio.service`, and smoke check the relevant routes.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the previous carousel behavior is restored.

## Result

Implemented for the desktop Gallery Carousel. Hiding the controls now moves focus to the carousel stage, so Space pause/resume and ArrowLeft/ArrowRight held scrubbing keep working immediately after `Hide UI`. The same focus handoff is used when hiding controls with `H`.
