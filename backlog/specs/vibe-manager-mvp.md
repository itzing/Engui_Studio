# Vibe Manager MVP Spec

## Purpose

Vibe Manager stores and manages a reusable library of vibe presets.

A vibe preset is a compact semantic atmosphere definition. It is not a final prompt, not a scene modifier, and not a runtime expansion cache.

Scene Manager will later select a vibe and decide how to apply it in scene context.

## Core Boundaries

### In scope
- create vibe preset
- edit vibe preset
- save vibe preset
- clone vibe preset
- soft delete to trash
- restore from trash
- search presets
- sort presets
- extract vibe draft from prompt

### Out of scope for MVP
- import/export
- favorites
- usage counts
- duplicate detection
- folders/groups
- permanent delete
- semantic search
- runtime expansion preview
- scene-level strength/emphasis controls
- info side panel
- tag filter
- scene-type filter
- notes field

## Data Model

Entity: `VibePreset`

```json
{
  "id": "string",
  "name": "string",
  "baseDescription": "string",
  "tags": ["string"],
  "compatibleSceneTypes": ["string"],
  "status": "active | trash",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

## Field Rules

### Required
- `name`: non-empty
- `baseDescription`: non-empty

### Optional
- `tags`
- `compatibleSceneTypes`

### Normalization
For both `tags` and `compatibleSceneTypes`:
- trim whitespace
- collapse obvious whitespace noise
- lowercase
- dedupe after normalization

### Status
Persisted presets only use:
- `active`
- `trash`

`draft` is UI state only and is not stored in the database.

## Semantics

### baseDescription
`baseDescription` is the semantic core of the vibe.

It is the field later used by Scene Manager and LLM runtime expansion.

### compatibleSceneTypes
`compatibleSceneTypes` is advisory metadata.

It is:
- visible to the user
- editable by the user
- mainly intended as a structured hint for later LLM scene-compatibility matching

It is not a hard UI filter in Vibe Manager MVP.

## Layout

MVP layout is 2-panel, not 3-panel.

- left panel: library
- center panel: editor

There is no persistent right panel.

## Top Bar Actions

- New
- Clone
- Delete
- Restore (trash mode only)
- Save
- small secondary action: Extract from Prompt

Not included in MVP:
- Import
- Export
- Close button if container already has standard close affordance

## Left Panel: Library

### Controls
- search
- sort
- active/trash toggle

### Search
Simple text search only.

Matches against:
- `name`
- `baseDescription`
- `tags`
- `compatibleSceneTypes`

No semantic search in MVP.

### Sort
- name ascending
- name descending
- recently updated
- recently created

### List item content
Each row shows only:
- `name`

No preview text, tags, or compatibility badges in the Vibe Manager library MVP.

## Center Panel: Editor

Fields:
- Name
- Base Description
- Tags
- Compatible Scene Types

### Inputs
- `Name`: single-line input
- `Base Description`: simple multiline textarea
- `Tags`: chip input
- `Compatible Scene Types`: chip input

### Chip input behavior
- freeform values
- create chip on `Enter`
- create chip on `,`
- normalized to lowercase
- deduped

## Draft Model

The editor always works on a draft.

### New
Creates a blank new draft.
- no DB record yet
- focus goes to `Name`

### Clone
Creates a new unsaved draft copied from the current preset.
Copies:
- `name`
- `baseDescription`
- `tags`
- `compatibleSceneTypes`

Resets:
- `id`
- `createdAt`
- `updatedAt`
- `status`

Clone naming rule:
- append `Copy` to the name

### Save
Only persists when the draft is valid and dirty.

Save is enabled only when:
- draft has changes
- `name` is non-empty
- `baseDescription` is non-empty

No autosave.

## Dirty State Rules

Dirty state exists only for the current editor draft.

### Guarded navigation
Prompt the user on navigation away from a dirty draft for actions like:
- selecting another preset
- New
- Clone
- closing the manager

Prompt options:
- save
- discard
- cancel

### Exception
`Extract from Prompt` is explicitly destructive and does **not** show a guard.
It is treated as a deliberate replace action.

## Extract from Prompt

### UX
- opened from a small secondary action
- uses a small modal
- modal contains a multiline prompt input
- submit via button
- submit via `Ctrl+Enter`
- while modal is active, other global `Ctrl+Enter` actions must be disabled

### Request behavior
- modal locks while request is running
- button shows spinner/loading state
- user cannot double-submit during active extraction

### Success behavior
- successful extraction creates a **new draft**
- current editor content is fully replaced
- modal closes automatically
- no separate preview/result panel

### Error behavior
- modal stays open
- entered prompt stays intact
- error is shown inside the modal
- error block includes copy button/icon

## Extraction Output Contract

```json
{
  "name": "string | empty",
  "baseDescription": "string",
  "tags": ["string"],
  "compatibleSceneTypes": ["string"],
  "confidence": "high | medium | low"
}
```

### Extraction notes
- `confidence` is internal for MVP and is not shown in UI
- low confidence does not create a special flow, it still fills the new draft
- `name` is best-effort; if empty, user can still edit and save later

## Trash Mode

Trash mode is read-only.

Allowed:
- view trashed preset
- restore preset

Not allowed:
- edit
- clone
- save changes
- permanent delete in MVP

## Validation

### Save validation only
- `name`: non-empty
- `baseDescription`: non-empty

No semantic validation in MVP.

## Scene Manager Relationship

Vibe Manager owns:
- vibe CRUD
- reusable vibe library
- extraction into vibe drafts

Scene Manager will later own:
- selecting a vibe for a scene
- compatibility indication in scene context
- runtime application strength
- LLM-based expansion in scene context

`compatibleSceneTypes` exists primarily to support that later scene-aware matching flow, not as a strict Vibe Manager filter.
