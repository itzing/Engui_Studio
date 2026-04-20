# Engui Mobile Route-Based PWA Plan

## Goal

Build a separate route-based mobile PWA experience for Engui Studio without changing the current desktop UX, desktop layout composition, or desktop routing behavior.

## Core decision

Desktop and mobile will share business logic, API contracts, and draft persistence where useful, but they will not share the same top-level UI composition.

- Desktop stays on the current layout and behavior.
- Mobile gets a dedicated route tree under `/m/*`.

## Why this is necessary

The current phone/PWA experience reuses desktop-oriented layout pieces inside a mobile shell:

- a long form-heavy Create screen
- nested scroll containers
- bottom navigation in the same layout flow
- keyboard-heavy editing inside the same page
- sticky sections coexisting with safe-area and dynamic viewport behavior

This is fragile on iPhone PWA, especially around:

- focus zoom
- dynamic viewport height
- keyboard open and close
- safe-area handling
- sticky and fixed elements inside long form screens

The route-based mobile app removes most of that complexity by turning heavy interactions into dedicated screens.

## Non-goals

- Do not redesign the desktop experience.
- Do not replace desktop `LeftPanel`, `CenterPanel`, or `RightPanel`.
- Do not migrate the whole app to mobile-first routing in one step.
- Do not ship more CSS or viewport hacks on top of the current mobile shell as the main strategy.

## Constraints

- Desktop behavior must remain unchanged.
- Existing APIs should continue to work for both desktop and mobile.
- Mobile should prefer dedicated components over desktop layout reuse.
- Keyboard-heavy interactions should happen on dedicated mobile screens, not inside the main long form when possible.
- PWA `start_url` must not switch until the mobile route tree is ready.

## Product decision

### Desktop

Keep the current desktop app exactly as the primary web experience:

- current `/` desktop entry
- current `MainLayout` desktop branch
- current `LeftPanel`, `CenterPanel`, and `RightPanel` composition

Desktop should only receive low-risk shared-logic refactors when needed.

### Mobile

Introduce a separate mobile route tree:

- `/m/create`
- `/m/create/prompt`
- `/m/create/scenes`
- `/m/create/advanced`
- `/m/create/model`
- `/m/preview`
- `/m/jobs`
- `/m/jobs/[id]`
- `/m/gallery`
- `/m/gallery/[id]`

Optional later:

- `/m/create/image-input`
- `/m/create/lora`
- `/m/settings`

## Architectural approach

### Separate UI, shared logic

The main principle is:

- do share state, services, hooks, and API logic
- do not share desktop top-level UI composition with mobile

This means:

- mobile screens should not mount the current desktop `LeftPanel` as their main Create experience
- mobile screens should not depend on the current `MobileStudioLayout` stateful tab shell long-term
- desktop form behavior can stay intact while shared create logic moves out into reusable hooks and services

### New mobile component namespace

Recommended component structure:

- `src/components/mobile/MobileAppShell.tsx`
- `src/components/mobile/MobileBottomNav.tsx`
- `src/components/mobile/MobileScreen.tsx`
- `src/components/mobile/MobileHeader.tsx`
- `src/components/mobile/create/MobileCreateHome.tsx`
- `src/components/mobile/create/MobilePromptScreen.tsx`
- `src/components/mobile/create/MobileScenesScreen.tsx`
- `src/components/mobile/create/MobileAdvancedScreen.tsx`
- `src/components/mobile/create/MobileModelScreen.tsx`
- `src/components/mobile/jobs/MobileJobsScreen.tsx`
- `src/components/mobile/jobs/MobileJobDetailsScreen.tsx`
- `src/components/mobile/gallery/MobileGalleryScreen.tsx`
- `src/components/mobile/gallery/MobileGalleryDetailsScreen.tsx`
- `src/components/mobile/preview/MobilePreviewScreen.tsx`

### Shared logic extraction

Candidate shared pieces to extract from desktop-oriented forms:

- create draft state
- model selection state
- prompt state
- image input state
- scene apply logic
- parameter normalization
- submit logic
- prompt helper actions
- image to prompt actions
- jobs refresh and polling hooks
- gallery list and details hooks

Suggested locations:

- `src/lib/create/*`
- `src/hooks/create/*`
- `src/hooks/jobs/*`
- `src/hooks/gallery/*`
- `src/lib/mobile/*`

## Mobile UX model

### `/m/create`

This should be a short dashboard-like screen, not a giant desktop form.

Show summary cards for:

- current model
- prompt summary
- selected scene summary
- input image summary
- key parameter summary
- generate action

The screen should link into focused editing flows rather than exposing every field inline.

### `/m/create/prompt`

Prompt editing must live on a dedicated fullscreen screen.

This is the primary keyboard-heavy route and should contain:

- a full-height textarea
- save and back actions
- optional prompt helper entry point
- minimal chrome

### `/m/create/scenes`

Dedicated screen for:

- scene list
- scene details and summary
- apply prompt
- apply full scene
- apply latest preview image

### `/m/create/advanced`

Dedicated screen for advanced parameters.

This keeps the main Create screen short and avoids huge in-page mobile forms.

### `/m/jobs` and `/m/gallery`

Jobs and Gallery should each be standalone screens.
Details should open as standalone routes where possible, instead of desktop-style dialogs.

## Routing and navigation

Use route navigation for the mobile app instead of local tab state.

Bottom navigation should map to routes:

- Create -> `/m/create`
- Preview -> `/m/preview`
- Jobs -> `/m/jobs`
- Gallery -> `/m/gallery`

Heavy editors should push to subroutes.

## State and persistence

### Draft state model

Mobile create routes need shared draft state across pages.

Recommended approach:

- mobile-scoped draft store
- persisted in local storage
- keyed by workflow and model where appropriate

Suggested draft shape:

- workflow
- selected model
- prompt
- image inputs
- selected scene
- basic parameters
- advanced parameters
- helper instruction draft

This store should power:

- `/m/create`
- `/m/create/prompt`
- `/m/create/scenes`
- `/m/create/advanced`
- `/m/create/model`

## PWA strategy

The installed PWA should open into the mobile route tree only after the mobile app is ready.

Recommended final setting:

- `start_url: /m/create`

Do this late in rollout, not at the beginning.

## Delivery phases

### Phase 1. Architecture groundwork

- add mobile route tree skeleton under `/m/*`
- add dedicated mobile shell
- keep desktop untouched
- keep current mobile shell as fallback until new screens are ready

### Phase 2. Shared logic extraction

- extract create draft and submit logic from desktop forms
- extract jobs and gallery data hooks
- ensure desktop behavior remains unchanged

### Phase 3. Mobile create flow

- build `/m/create`
- build `/m/create/prompt`
- build `/m/create/scenes`
- build `/m/create/advanced`
- build `/m/create/model`
- connect generate flow

### Phase 4. Mobile read screens

- build `/m/preview`
- build `/m/jobs`
- build `/m/jobs/[id]`
- build `/m/gallery`
- build `/m/gallery/[id]`

### Phase 5. QA and hardening

- iPhone PWA keyboard tests
- safe-area tests
- orientation tests
- draft persistence tests
- standalone mode tests
- desktop regression pass

### Phase 6. PWA switch

- point PWA `start_url` to `/m/create`
- keep desktop web entry unchanged
- verify installed PWA behavior on iPhone

## Desktop protection rules

Desktop must remain visually unchanged.

Allowed desktop changes:

- shared hooks and service extraction
- wiring changes with no intentional UI changes
- regression fixes caused by refactor

Not allowed in this milestone:

- desktop layout redesign
- desktop route replacement
- desktop create flow rewrite
- replacing current desktop multi-panel composition with mobile abstractions

## Risks

### Risk 1. Shared logic extraction leaks UI regressions into desktop

Mitigation:

- move logic gradually
- keep desktop regression checks in each ticket
- avoid mixing desktop visual cleanup into the milestone

### Risk 2. Mobile route tree duplicates too much code

Mitigation:

- share hooks and service functions
- do not share desktop top-level components

### Risk 3. PWA switch happens too early

Mitigation:

- keep `start_url` switch as the final delivery step

## Success criteria

Phone PWA users should be able to:

- open Engui into a dedicated mobile route tree
- edit prompt without layout breakage from the main Create screen
- move between Create, Preview, Jobs, and Gallery using route-based navigation
- use the app on iPhone PWA without major viewport and keyboard regressions caused by the current desktop-shaped mobile shell

Desktop users should see no meaningful UX change.

## Rollback plan

Safe rollback path:

- mobile app lives under `/m/*`
- desktop continues to live on current routes
- if needed, revert the mobile route tree without touching desktop UI
- if needed, keep mobile routes dark until ready
- switch PWA `start_url` only after validation, so rollback is one config change plus revert

## Recommended implementation order

1. Define route-based mobile architecture and desktop protection rules
2. Add isolated mobile route tree under `/m/*`
3. Extract shared create draft and submit logic
4. Build `/m/create`
5. Build `/m/create/prompt`
6. Build `/m/create/scenes`, `/m/create/model`, and `/m/create/advanced`
7. Build `/m/preview`, `/m/jobs`, and `/m/gallery`
8. Add detail routes for Jobs and Gallery
9. Run iPhone PWA QA and desktop regression pass
10. Switch PWA `start_url` to mobile routes
