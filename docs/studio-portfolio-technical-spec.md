# Studio Portfolio Technical Specification

## Status

Draft technical specification for refactoring Studio Sessions into a portfolio-first workflow.

Related planning document:

- `docs/studio-portfolio-refactor-plan.md`

## Objective

Replace the current template-first Studio Sessions workflow with a portfolio-first architecture:

```text
Portfolio -> Session/Shoot -> Run -> Shot/Version -> Picks -> Collection
```

The implementation must preserve the existing Studio Sessions functionality until the new flow can generate, review, and curate images end-to-end.

## Current Architecture Inventory

### Existing Prisma Models

Current Studio models in `prisma/schema.prisma`:

- `StudioSessionTemplate`
- `StudioSessionTemplateCategoryRule`
- `StudioSessionRun`
- `StudioSessionShot`
- `StudioSessionShotRevision`
- `StudioSessionShotVersion`
- `StudioSessionJobMaterialization`

Important current relationships:

```text
Workspace
  -> StudioSessionTemplate
      -> StudioSessionTemplateCategoryRule[]
      -> StudioSessionRun[]
  -> StudioSessionRun
      -> StudioSessionShot[]
          -> StudioSessionShotRevision[]
          -> StudioSessionShotVersion[]
```

`StudioSessionTemplate` currently owns:

- character link
- session-like prompt fields (`environmentText`, `outfitText`, `hairstyleText`)
- run-like prompt fields (`positivePrompt`, `negativePrompt`)
- generation settings JSON
- resolution policy
- category count rules
- canonical/draft state JSON

This is why it behaves like a mixed Session + Run Settings entity.

### Existing TypeScript Types

Current type definitions live in:

- `src/lib/studio-sessions/types.ts`

Key current types:

- `StudioSessionTemplateDraftState`
- `StudioSessionTemplateSavedState`
- `StudioSessionTemplateSummary`
- `StudioSessionRunSummary`
- `StudioSessionRunDetailSummary`
- `StudioSessionShotSummary`
- `StudioSessionShotRevisionSummary`
- `StudioSessionShotVersionSummary`

### Existing Server Utilities

Current server logic lives mainly in:

- `src/lib/studio-sessions/server.ts`
- `src/lib/studio-sessions/utils.ts`
- `src/lib/studio-sessions/poseLibrary.ts`

Important current functions:

- `createStudioSessionRun({ workspaceId, templateId })`
- `assembleStudioSessionRun(runId)`
- `buildStudioSessionShotSlotsFromRules(rules)`
- `assembleStudioSessionPrompt(input)`
- `deriveStudioSessionRunStatus(input)`
- materialization helpers for finished jobs

### Existing UI

Current UI component:

- `src/components/studio-sessions/StudioSessionsPageClient.tsx`

Current tabs:

- Templates
- Runs

Current Templates tab combines:

- template list
- template editor
- character selector
- prompt/session fields
- model/generation settings
- category sliders
- run creation

Current Runs tab handles:

- run list
- run details
- shots
- manual pose picker
- job launch/review/materialization

## Target Data Model

### New Models Overview

Add these models while keeping existing models operational:

- `StudioPortfolio`
- `StudioPhotoSession`
- `StudioSessionRunPreset`
- `StudioCollection`
- `StudioCollectionItem`

Modify existing models:

- `StudioSessionRun`: add `portfolioId`, `photoSessionId`, `poseSetId`, run settings fields.
- `StudioSessionShotVersion`: add review fields or normalize review into a new table.
- `StudioSessionShot`: optionally add `poseSetId` for query convenience.

Do not remove legacy template fields in the first implementation phase.

### Prisma Schema Draft

```prisma
model StudioPortfolio {
  id            String   @id @default(uuid())
  workspaceId   String
  characterId   String
  name          String
  description   String   @default("")
  status        String   @default("active") // active | archived
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  character     Character @relation(fields: [characterId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  sessions      StudioPhotoSession[]
  collections   StudioCollection[]
  runs          StudioSessionRun[]

  @@index([workspaceId, status, updatedAt(sort: Desc)])
  @@index([workspaceId, characterId, status, updatedAt(sort: Desc)])
  @@map("studio_portfolios")
}

model StudioPhotoSession {
  id             String   @id @default(uuid())
  workspaceId    String
  portfolioId    String
  name           String
  settingText    String   @default("")
  lightingText   String   @default("")
  vibeText       String   @default("")
  outfitText     String   @default("")
  hairstyleText  String   @default("")
  negativePrompt String   @default("")
  notes          String   @default("")
  status         String   @default("draft") // draft | active | review | completed | archived
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  workspace      Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  portfolio      StudioPortfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  runs           StudioSessionRun[]
  collections    StudioCollectionItem[]

  @@index([workspaceId, portfolioId, status, updatedAt(sort: Desc)])
  @@index([portfolioId, updatedAt(sort: Desc)])
  @@map("studio_photo_sessions")
}

model StudioSessionRunPreset {
  id                     String   @id @default(uuid())
  workspaceId             String
  name                   String
  description            String   @default("")
  generationSettingsJson String   @default("{}")
  resolutionPolicyJson   String   @default("{}")
  promptDefaultsJson     String   @default("{}")
  status                 String   @default("active") // active | archived
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  workspace              Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status, updatedAt(sort: Desc)])
  @@map("studio_session_run_presets")
}

model StudioCollection {
  id          String   @id @default(uuid())
  workspaceId String
  portfolioId String
  name        String
  description String   @default("")
  status      String   @default("draft") // draft | final | archived
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  portfolio   StudioPortfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  items       StudioCollectionItem[]

  @@index([workspaceId, portfolioId, status, updatedAt(sort: Desc)])
  @@index([portfolioId, updatedAt(sort: Desc)])
  @@map("studio_collections")
}

model StudioCollectionItem {
  id              String   @id @default(uuid())
  workspaceId     String
  collectionId    String
  portfolioId     String
  photoSessionId  String?
  runId           String?
  shotId          String?
  versionId       String
  sortOrder       Int      @default(0)
  caption         String   @default("")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace                @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  collection      StudioCollection         @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  portfolio       StudioPortfolio          @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
  photoSession    StudioPhotoSession?      @relation(fields: [photoSessionId], references: [id], onDelete: SetNull)
  run             StudioSessionRun?        @relation(fields: [runId], references: [id], onDelete: SetNull)
  shot            StudioSessionShot?       @relation(fields: [shotId], references: [id], onDelete: SetNull)
  version         StudioSessionShotVersion @relation(fields: [versionId], references: [id], onDelete: Cascade)

  @@unique([collectionId, versionId])
  @@index([workspaceId, portfolioId, collectionId, sortOrder])
  @@index([versionId])
  @@map("studio_collection_items")
}
```

### Existing Model Extensions

Add nullable fields first to avoid breaking legacy data.

```prisma
model StudioSessionRun {
  // existing fields...
  portfolioId              String?
  photoSessionId           String?
  poseSetId                String?
  name                     String @default("")
  runSettingsJson          String @default("{}")
  promptOverrideJson       String @default("{}")
  resolutionPolicyJson     String @default("{}")
  count                    Int    @default(0)

  portfolio                StudioPortfolio?    @relation(fields: [portfolioId], references: [id], onDelete: SetNull)
  photoSession             StudioPhotoSession? @relation(fields: [photoSessionId], references: [id], onDelete: SetNull)
  collectionItems          StudioCollectionItem[]

  @@index([workspaceId, portfolioId, updatedAt(sort: Desc)])
  @@index([workspaceId, photoSessionId, updatedAt(sort: Desc)])
  @@index([workspaceId, poseSetId, updatedAt(sort: Desc)])
}

model StudioSessionShotVersion {
  // existing fields...
  reviewState              String @default("unreviewed") // unreviewed | pick | maybe | reject | hero | needs_retry
  reviewNote               String @default("")
  reviewedAt               DateTime?
  collectionItems          StudioCollectionItem[]

  @@index([workspaceId, reviewState, createdAt(sort: Desc)])
}
```

Keep existing `hidden` and `rejected` fields temporarily. They can be mapped to review states later:

- `hidden = true` -> hidden from default views
- `rejected = true` -> `reviewState = reject`

## TypeScript Types

Create a new type module:

- `src/lib/studio/portfolioTypes.ts`

or extend the existing module if we keep all Studio types together:

- `src/lib/studio-sessions/types.ts`

Preferred: create a new `src/lib/studio` namespace and migrate gradually.

### Draft Types

```ts
export type StudioPortfolioStatus = 'active' | 'archived';
export type StudioPhotoSessionStatus = 'draft' | 'active' | 'review' | 'completed' | 'archived';
export type StudioCollectionStatus = 'draft' | 'final' | 'archived';
export type StudioVersionReviewState = 'unreviewed' | 'pick' | 'maybe' | 'reject' | 'hero' | 'needs_retry';

export interface StudioPortfolioSummary {
  id: string;
  workspaceId: string;
  characterId: string;
  characterName: string;
  characterPreviewUrl: string | null;
  name: string;
  description: string;
  status: StudioPortfolioStatus;
  sessionCount: number;
  collectionCount: number;
  selectedImageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudioPhotoSessionSummary {
  id: string;
  workspaceId: string;
  portfolioId: string;
  name: string;
  settingText: string;
  lightingText: string;
  vibeText: string;
  outfitText: string;
  hairstyleText: string;
  negativePrompt: string;
  notes: string;
  status: StudioPhotoSessionStatus;
  runCount: number;
  pickCount: number;
  maybeCount: number;
  rejectCount: number;
  heroVersionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudioRunSettingsDraft {
  name: string;
  poseSetId: string | null;
  count: number;
  positivePromptOverride: string;
  negativePromptOverride: string;
  generationSettings: StudioSessionGenerationSettingsSnapshot;
  resolutionPolicy: StudioSessionResolutionPolicy;
}

export interface StudioCollectionSummary {
  id: string;
  workspaceId: string;
  portfolioId: string;
  name: string;
  description: string;
  status: StudioCollectionStatus;
  itemCount: number;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## Pose Set Design

### MVP Pose Set Model

For MVP, a pose set can be a virtual layer over current pose categories.

Create:

- `src/lib/studio-sessions/poseSets.ts`

Initial `PoseSet` type:

```ts
export interface StudioPoseSetSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  poseIds: string[];
  tags: string[];
}
```

MVP implementation:

- Build one default pose set per existing category.
- `poseSet.id` can be `category:${category}`.
- `poseSet.poseIds` includes all poses in that category.

Later implementation:

- Add persisted `StudioPoseSet` table.
- Allow user-curated pose sets.

### Run Slot Generation

Replace current multi-category slot builder:

```ts
buildStudioSessionShotSlotsFromRules(categoryRules)
```

with:

```ts
buildStudioRunShotSlotsFromPoseSet({ poseSetId, count })
```

MVP behavior:

- Resolve pose set to one category.
- Create `count` shots in that category.
- Preserve labels such as `Chair Portraits 1`, `Chair Portraits 2`.

Important rule:

```text
One run must not generate shots from multiple unrelated pose sets.
```

## Prompt Assembly Changes

Current prompt assembly uses template saved state:

```ts
StudioSessionRunSnapshot extends StudioSessionTemplateSavedState
```

Target prompt assembly input:

```ts
interface StudioRunPromptContext {
  portfolio: {
    characterId: string;
    characterPrompt: string;
    characterAge: string;
  };
  session: {
    settingText: string;
    lightingText: string;
    vibeText: string;
    outfitText: string;
    hairstyleText: string;
    negativePrompt: string;
  };
  run: {
    positivePromptOverride: string;
    negativePromptOverride: string;
    generationSettings: StudioSessionGenerationSettingsSnapshot;
    resolutionPolicy: StudioSessionResolutionPolicy;
  };
  pose: StudioSessionPoseSnapshot;
}
```

Target assembled prompt pieces:

```ts
pieces: {
  character: string;
  characterAge: string;
  setting: string;
  lighting: string;
  vibe: string;
  outfit: string;
  hairstyle: string;
  sessionNegative: string;
  runPositiveOverride: string;
  runNegativeOverride: string;
  pose: string;
}
```

Negative prompt should be composed as:

```ts
joinPromptFragments([
  session.negativePrompt,
  run.negativePromptOverride,
])
```

## API Specification

Use `/api/studio/...` for new API routes. Keep `/api/studio-sessions/...` legacy routes until cleanup.

### Portfolios

#### `GET /api/studio/portfolios`

Query:

- `workspaceId`: required
- `status`: optional, default `active`

Response:

```ts
{
  success: true,
  portfolios: StudioPortfolioSummary[]
}
```

#### `POST /api/studio/portfolios`

Body:

```ts
{
  workspaceId: string;
  characterId: string;
  name?: string;
  description?: string;
}
```

Behavior:

- Validate workspace and character.
- Default name to `${character.name} Portfolio`.
- Create portfolio.

#### `GET /api/studio/portfolios/[id]`

Response includes:

- portfolio summary
- character summary
- session summaries
- collection summaries

#### `PATCH /api/studio/portfolios/[id]`

Actions:

- update name/description/status
- archive/restore

### Sessions

#### `GET /api/studio/portfolios/[id]/sessions`

Response:

```ts
{
  success: true,
  sessions: StudioPhotoSessionSummary[]
}
```

#### `POST /api/studio/portfolios/[id]/sessions`

Body:

```ts
{
  name: string;
  settingText?: string;
  lightingText?: string;
  vibeText?: string;
  outfitText?: string;
  hairstyleText?: string;
  negativePrompt?: string;
  notes?: string;
}
```

#### `GET /api/studio/sessions/[id]`

Response includes:

- session summary
- portfolio summary
- character summary
- runs
- contact sheet versions

#### `PATCH /api/studio/sessions/[id]`

Update session brief and status.

### Runs

#### `GET /api/studio/sessions/[id]/runs`

List runs for session.

#### `POST /api/studio/sessions/[id]/runs`

Create a run draft.

Body:

```ts
{
  name?: string;
  poseSetId: string;
  count: number;
  positivePromptOverride?: string;
  negativePromptOverride?: string;
  generationSettings: StudioSessionGenerationSettingsSnapshot;
  resolutionPolicy: StudioSessionResolutionPolicy;
}
```

Behavior:

- Validate session.
- Validate pose set.
- Create `StudioSessionRun` with `portfolioId` and `photoSessionId`.
- Create shot slots from one pose set and count.

#### `PATCH /api/studio/runs/[id]`

Update draft run settings if no active jobs exist.

#### `POST /api/studio/runs/[id]/launch`

Launch jobs for assigned shots.

Equivalent to the current run execution path, but uses session/run prompt context instead of template snapshot.

#### `POST /api/studio/runs/[id]/duplicate`

Duplicate run settings into a new draft run in the same session.

#### `POST /api/studio/runs/[id]/save-preset`

Create `StudioSessionRunPreset` from run settings.

### Review

#### `PATCH /api/studio/versions/[id]/review`

Body:

```ts
{
  reviewState: StudioVersionReviewState;
  reviewNote?: string;
}
```

Behavior:

- Update `reviewState`, `reviewNote`, `reviewedAt`.
- If setting `hero`, optionally clear existing hero in the same session or run depending on product decision.

### Collections

#### `GET /api/studio/portfolios/[id]/collections`

List collections.

#### `POST /api/studio/portfolios/[id]/collections`

Create collection.

#### `GET /api/studio/collections/[id]`

Get collection with ordered items.

#### `POST /api/studio/collections/[id]/items`

Body:

```ts
{
  versionId: string;
  caption?: string;
}
```

Behavior:

- Validate version belongs to the same portfolio.
- Add item at end of collection.

#### `PATCH /api/studio/collections/[id]/items/reorder`

Body:

```ts
{
  itemIds: string[];
}
```

#### `DELETE /api/studio/collections/[id]/items/[itemId]`

Remove item from collection.

## UI Component Plan

### New Route Structure

Preferred app routes:

```text
/studio-sessions                         -> portfolio home initially, keep old URL
/studio-sessions/portfolios/[id]         -> portfolio detail
/studio-sessions/sessions/[id]           -> session detail
/studio-sessions/collections/[id]        -> collection detail
```

We can keep the existing `/studio-sessions` path to avoid navigation churn.

### Components

Create new component folders:

```text
src/components/studio/portfolios/
src/components/studio/sessions/
src/components/studio/runs/
src/components/studio/collections/
```

Key components:

- `PortfolioListPageClient`
- `PortfolioCard`
- `CreatePortfolioDialog`
- `PortfolioDetailPageClient`
- `SessionCard`
- `SessionBriefEditor`
- `RunSettingsPanel`
- `PoseSetPicker`
- `SessionContactSheet`
- `VersionReviewControls`
- `CollectionGridEditor`

Reusable existing components:

- `CharacterSelectModal`
- `CharacterPreviewTriptych`
- `LoRAManagementDialog`
- LoRA selector logic from current StudioSessionsPageClient
- existing manual pose picker UI, adapted to pose set context

### RunSettingsPanel Extraction

Extract from current `StudioSessionsPageClient.tsx`:

- model selector
- generation settings
- LoRA fields
- resolution policy
- prompt override fields

Remove from extracted panel:

- template name
- character selector
- category sliders
- session brief fields

Add:

- pose set picker
- count input
- save as preset / load preset actions

### Portfolio Home UX

Initial `/studio-sessions` view:

- list portfolios
- create portfolio button
- portfolio card with character preview, session count, collection count
- no template list as primary UI

Legacy templates can be behind a temporary link:

```text
Legacy templates
```

### Portfolio Detail UX

Tabs:

- Sessions
- Collections
- Character
- Presets (later)

### Session Detail UX

Layout:

- Header: session name, portfolio/character, status
- Left/top: Session Brief editor
- Runs list
- Add Run button
- Contact Sheet
- Picks strip

### Contact Sheet UX

Each image card:

- thumbnail/preview
- run name
- pose name
- review buttons: Hero / Pick / Maybe / Reject / Retry
- add to collection action

Filters:

- run
- pose set
- review state
- hidden/rejected toggle

## Migration and Compatibility Strategy

### Phase A: Additive Schema

- Add new tables and nullable fields.
- Do not delete old template tables.
- Existing Studio Sessions UI continues to work.

### Phase B: New Read/Write APIs

- Implement new portfolio/session/run APIs.
- New runs write both new fields and existing shot/revision/version structures.
- Materialization should continue to work with existing `studioSessionContext`.

Extend job context:

```ts
studioSessionContext: {
  workspaceId: string;
  portfolioId?: string;
  photoSessionId?: string;
  runId: string;
  shotId: string;
  revisionId: string;
  label?: string;
  executionMode?: string;
}
```

Existing materialization code can ignore unknown fields initially.

### Phase C: Legacy Template Adapter

Add helpers:

```ts
legacyTemplateToSessionDraft(template): StudioPhotoSessionDraft
legacyTemplateToRunDrafts(template): StudioRunSettingsDraft[]
```

For each non-zero category rule in old templates, create a run draft:

```text
category rule -> virtual pose set -> run draft
```

### Phase D: UI Switch

- Make portfolio home default.
- Keep legacy template UI under a temporary route or hidden debug link.
- Add migration action if needed.

### Phase E: Cleanup

After new workflow is stable:

- archive old template UI
- remove category-rule-first run creation
- rename old code paths where practical

## Data Migration Draft

### Existing Template to New Structures

For each `StudioSessionTemplate`:

1. Resolve character.
2. Find or create portfolio by `(workspaceId, characterId)`.
3. Create `StudioPhotoSession`:
   - `name = template.name`
   - `settingText = template.environmentText`
   - `outfitText = template.outfitText`
   - `hairstyleText = template.hairstyleText`
   - `negativePrompt = template.negativePrompt`
   - `vibeText = template.positivePrompt` initially or leave empty.
4. For each category rule with `count > 0`, create one `StudioSessionRun` draft:
   - `poseSetId = category:${rule.category}`
   - `count = rule.count`
   - copy `generationSettingsJson`
   - copy resolution policy
   - `positivePromptOverride = template.positivePrompt`
5. Do not launch migrated runs automatically.

## Testing Plan

### Unit Tests

Add tests for:

- portfolio summary serialization
- session summary serialization
- run draft normalization
- pose set resolution
- slot generation from pose set
- prompt context assembly
- review state transitions
- collection item validation
- legacy template adapter

### API Tests

Add tests for:

- create/list portfolios
- create/update sessions
- create/update/launch runs
- one-run-one-pose-set validation
- review endpoint
- collection add/reorder/remove
- cross-portfolio collection validation failure

### UI Tests

Add component tests for:

- portfolio home renders cards
- create portfolio dialog uses `CharacterSelectModal`
- session brief editor updates fields
- run settings panel selects one pose set
- contact sheet review controls
- collection editor reorder/remove

### Build Gate

Required before merge/deploy:

- targeted vitest for changed modules
- `npm run build`
- service restart after production build for deployed UI changes

## Risks and Mitigations

### Risk: Big-bang rewrite breaks current Studio Sessions

Mitigation:

- additive schema first
- new APIs alongside old APIs
- keep legacy template UI until new flow works end-to-end

### Risk: Naming confusion between session/run/template

Mitigation:

- product language: Portfolio, Session, Run, Collection
- avoid Template in primary UI
- keep `Run Preset` only as optional reusable settings

### Risk: Pose set model becomes too abstract too early

Mitigation:

- MVP virtual pose sets derived from existing categories
- persisted/user-editable pose sets later

### Risk: Review state conflicts with existing hidden/rejected booleans

Mitigation:

- add `reviewState` without deleting old fields
- map `rejected` to `reviewState = reject` in UI
- later cleanup after migration

### Risk: Old template migration creates too much clutter

Mitigation:

- do not auto-migrate in first phase unless needed
- provide manual migration/import action or legacy archive

## Recommended Ticket Breakdown

Create backlog tickets in this order before implementation.

### Epic 1 — Schema and core types

1. Add portfolio/session/collection/run preset Prisma models.
2. Add nullable portfolio/session/run fields to existing run/version models.
3. Add TypeScript summary/draft types and serializers.
4. Add virtual pose set utilities.

### Epic 2 — New APIs

5. Add portfolio list/create/update APIs.
6. Add session list/create/update APIs.
7. Add run create/update/launch APIs using one pose set.
8. Add version review API.
9. Add collection list/create/item APIs.

### Epic 3 — UI foundation

10. Add portfolio home UI.
11. Add create portfolio dialog using `CharacterSelectModal`.
12. Add portfolio detail shell with Sessions/Collections/Character tabs.
13. Add session brief editor.

### Epic 4 — Run workflow

14. Extract `RunSettingsPanel` from current template editor.
15. Replace category sliders with `PoseSetPicker` and count.
16. Add session run list and create run flow.
17. Wire run launch to new API.

### Epic 5 — Review and collections

18. Add session contact sheet.
19. Add review controls and filtering.
20. Add collection editor and add-to-collection flow.
21. Add export/add-to-gallery path for collections.

### Epic 6 — Legacy migration and cleanup

22. Add legacy template adapter.
23. Add optional legacy template migration action.
24. Move old template UI behind legacy entry.
25. Remove or archive old template-first flow after validation.

## MVP Definition of Done

The MVP is complete when a user can:

1. Open Studio and see character portfolios.
2. Create a portfolio from an existing character.
3. Create a session inside that portfolio.
4. Define setting/light/vibe/outfit/hairstyle for the session.
5. Add a run using one pose set and count.
6. Launch the run.
7. Review generated images in a session contact sheet.
8. Mark images as Pick/Reject/Hero.
9. Create a collection and add picked images to it.

## Implementation Recommendation

Do not implement this as one pull/commit. Build in vertical slices:

1. Add schema/types with no UI changes.
2. Add portfolio home with read/create only.
3. Add session creation and brief editing.
4. Add one-pose-set run creation using existing shot/version/job machinery.
5. Add review/contact sheet.
6. Add collections.
7. Only then demote legacy templates.

This keeps each step testable and avoids breaking existing generation/review behavior.
