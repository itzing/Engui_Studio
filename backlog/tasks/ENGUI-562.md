# ENGUI-562 - Desktop image-first Character Manager

Status: Done
Created: 2026-10-13
Labels: [characters, desktop, ux]

## Scope
Desktop-only image-first Overview and Details tabs. Keep the existing mobile layout and preview generation contract.

## Acceptance Criteria
- [x] Desktop opens to three large, uncropped Portrait / Upper body / Full body previews with fullscreen viewing.
- [x] Details contains basics, traits, visible parts, wardrobe, assistant editing and version history.
- [x] Switching tabs preserves character and outfit drafts, model/look selections and editor state.
- [x] New character opens Details; selecting a saved character opens Overview.
- [x] Existing mobile layout and generation actions remain available; no paid jobs launched.
- [x] Browser checks, production build, restart, commit and push complete.

## Delivery
Feature `94fff5b` deployed and pushed as Artem Ovechkin / itzing. Production build, service restart and live desktop/mobile browser checks passed. See docs/character-manager-overview-release.md. No generation or content writes.
