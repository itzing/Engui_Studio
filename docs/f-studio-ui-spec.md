# F-Studio UI Specification

## Product direction

F-Studio is the new desktop-only Studio v1 surface. It is a portfolio-first product flow, not a legacy template compatibility layer.

Primary hierarchy:

```text
Portfolios -> Character Portfolio -> Sessions -> Session -> Runs -> Run
Portfolios -> Character Portfolio -> Collections -> Collection
```

## Routing

Navigation is URL-based with Next.js client-side transitions. No full page reload is expected when moving between levels.

Planned routes:

- `/studio-sessions` — portfolio grid.
- `/studio-sessions/portfolios/:portfolioId` — portfolio context, Sessions grid by default.
- `/studio-sessions/portfolios/:portfolioId/collections` — collection grid for the portfolio.
- `/studio-sessions/portfolios/:portfolioId/sessions/:sessionId` — session detail.
- `/studio-sessions/portfolios/:portfolioId/sessions/:sessionId/runs` — run grid for the session.
- `/studio-sessions/portfolios/:portfolioId/sessions/:sessionId/runs/:runId` — run detail/review workspace.
- `/studio-sessions/portfolios/:portfolioId/collections/:collectionId` — collection detail.

## Layout

Desktop-only for now.

### Header

Top header contains:

- Large working title: `F-Studio`.
- Breadcrumb/location trail.

Breadcrumb examples:

- Portfolio list: `Portfolios`.
- Portfolio context: `Portfolios -> {Character name} ({age}yo/{gender})`.
- Session detail: `Portfolios -> {Character name} ({age}yo/{gender}) -> Sessions -> {Session name}`.
- Run detail: `Portfolios -> {Character name} ({age}yo/{gender}) -> Sessions -> {Session name} -> Runs -> {Run name}`.
- Collection detail: `Portfolios -> {Character name} ({age}yo/{gender}) -> Collections -> {Collection name}`.

Every ancestor breadcrumb is clickable and navigates to that level.

### Left navigation

Desktop left navigation has two modes:

- Expanded: icon + section label.
- Collapsed: icon only.

Collapsed state is persisted in localStorage.

Navigation items:

- `Portfolios` — always visible.
- `Sessions` — visible inside a portfolio context.
- `Collections` — visible inside a portfolio context.
- `Runs` — visible only inside a selected session.

### Workspace canvas

The remaining space is a workspace canvas rendering the current location control.

## Workspace controls

### Portfolios

- Large tiles.
- First tile is `+` for creating a new portfolio.
- Tile cover defaults to character portrait preview.
- Tile shows character name, age, gender.
- Portfolio cover can later be overridden only from a photo inside a Collection.

### Sessions

- Tile grid for sessions.
- First tile is `+` for creating a session.
- Clicking a session opens Session detail.

### Session

- Session brief/detail editor.
- Runs are not mixed into the session editor; Runs are a separate nav level.

### Runs

- Tile grid for runs in the current session.
- First tile is `+` for creating a run.
- Clicking a run opens Run detail.

### Run

- Run detail/review workspace.
- Contact sheet/review controls live here, scoped to the selected run.

### Collections

- Tile grid for portfolio collections.
- First tile is `+` for creating a collection.
- Clicking a collection opens Collection detail.

### Collection

- Tile grid of photos in the collection.
- Collection photos can expose `Set as portfolio cover`.
- Portfolio cover selection is restricted to collection photos only.

## Component strategy

Use existing project stack:

- Tailwind CSS.
- Existing shadcn-style primitives (`Button`, `Card`, `Dialog`, `Input`, `Tabs` where needed).
- No additional heavy UI library for this slice.

Use a stable responsive desktop grid:

```text
grid-cols-[repeat(auto-fill,minmax(260px,1fr))]
```

## Implementation slices

1. F-Studio shell and route-based navigation.
2. Portfolio/session/collection/run grids with `+` tiles.
3. Session detail and run detail separation.
4. Collection detail and portfolio cover action.
5. UX polish after visual direction is finalized.
