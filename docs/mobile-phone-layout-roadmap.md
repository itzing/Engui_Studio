# Engui phone-first web roadmap

## Goal

Make Engui genuinely usable on phones without degrading the current desktop experience and without forcing a native iOS client decision yet.

## Product decision

Desktop and tablet can keep the current multi-panel model.
Phone should use a dedicated layout mode instead of a compressed desktop layout.

## Core UX model for phone

### Navigation

Use a dedicated phone navigation model with 3 primary destinations:

- Create
- Preview
- Library

This replaces the always-visible desktop three-column composition on narrow screens.

### Screen responsibilities

#### Create
- Full-width generation form
- No permanent right panel
- Advanced settings collapsed by default
- Large touch targets
- Sticky primary generate action when appropriate

#### Preview
- Full-width result viewer
- Current center-panel actions adapted for touch
- Info button remains explicit
- Mobile-safe spacing and safe-area handling

#### Library
- Jobs and Gallery moved out of the permanent sidebar into a mobile-first screen
- Filters and sort still available, but arranged vertically / in sheets
- Full-width grid/list behavior for phone

## Architectural approach

### Keep desktop intact

Do not rewrite desktop composition.
Instead:

- keep `MainLayout` desktop behavior for tablet/desktop
- add phone breakpoint behavior that swaps the layout composition
- reuse existing `LeftPanel`, `CenterPanel`, and `RightPanel` logic where possible
- introduce mobile wrapper/navigation state instead of cloning business logic

### Likely implementation structure

- `MainLayout.tsx`
  - chooses desktop vs phone layout shell
- new mobile shell component, likely something like `MobileStudioLayout.tsx`
  - holds bottom navigation and current mobile section
- existing panels become more breakpoint-aware
- some panel content may need extraction into reusable inner components if current wrappers are too desktop-shaped

## Execution phases

### Phase 1, foundation
1. Add responsive layout state and phone breakpoint detection
2. Introduce phone layout shell with bottom navigation
3. Remove permanent right sidebar from phone layout
4. Route phone users between Create / Preview / Library views

### Phase 2, create screen usability
5. Simplify phone header
6. Improve form spacing and hit targets
7. Collapse advanced settings by default on phone
8. Rework width/height area into phone-friendly ratio presets + manual controls
9. Add sticky mobile primary action where needed

### Phase 3, preview and library adaptation
10. Make preview screen fully mobile-friendly
11. Convert jobs/gallery access into a real mobile library screen
12. Make mobile filter/sort controls usable without horizontal overflow

### Phase 4, polish
13. Safe-area and iOS viewport fixes
14. Keyboard avoidance and form focus behavior
15. Loading/skeleton polish for mobile interactions
16. Final UX pass for small phones

## Constraints

- Desktop UX should remain materially unchanged
- Tablet can stay closer to desktop unless a change clearly improves both
- Do not fork business logic unnecessarily
- Prefer layout-shell refactor over copy-pasting whole screens

## Suggested ticket breakdown

1. Add phone layout shell and bottom navigation
2. Make `MainLayout` switch between desktop and phone compositions
3. Move right-panel functionality into a mobile Library screen
4. Simplify phone header and top-level actions
5. Make generation forms mobile-friendly
6. Collapse advanced settings by default on phone
7. Add phone-friendly aspect ratio presets and dimension controls
8. Adapt preview screen for phone use
9. Add safe-area, viewport, and keyboard handling for iPhone
10. Mobile QA and polish pass

## Recommended implementation order

1. Layout shell and breakpoint routing
2. Library extraction from sidebar
3. Create screen usability fixes
4. Preview adaptation
5. Safe-area / keyboard fixes
6. QA polish

## Success criteria

Phone users should be able to:

- open Engui without horizontal-cramped three-panel layout
- generate comfortably from a full-width Create screen
- inspect results from a dedicated Preview screen
- browse Jobs/Gallery from a dedicated Library screen
- use the app on iPhone Safari without major viewport or keyboard pain

## Native app decision checkpoint

After this roadmap is complete, reassess whether any remaining pain actually requires native iOS.
Only then decide whether a native client is justified.
