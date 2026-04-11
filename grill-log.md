# Character Manager Grill Log

## Goal
Refine the Character Manager concept into an implementation-ready specification through one-question-at-a-time grilling.

## Working decisions already confirmed

- Trait values use free-form normalized text, normalization is handled by the model.
- There are two lock systems:
  - Volatility-level lock: can lock `core`, `stable`, `flexible`, and assistant must not modify those traits.
  - UI lock: determines whether a trait is sent to the assistant for editing.
- Group locks are supported, for example head, body, etc.
- New character version is created only when the user presses Save.
- Version is immutable.
- A version can be copied into the current editable state.
- Version snapshot stores only existing traits, empty traits are not stored.
- Missing traits are not compared.
- Preview generation rules will be specified later.
- Reference mechanics will be specified later.
- Locked traits are simply omitted from assistant-editable input.
- Manual trait editing happens via edit icon and modal, not free inline editing.
- Character is a concrete named entity.
- Cloning from a version creates a new character.

## Volatility mapping confirmed

```json
[
  { "key": "name", "volatility": "core" },
  { "key": "gender", "volatility": "core" },
  { "key": "ethnicity", "volatility": "core" },
  { "key": "skin_tone", "volatility": "core" },
  { "key": "undertone", "volatility": "core" },

  { "key": "face_shape", "volatility": "core" },
  { "key": "eye_color", "volatility": "core" },
  { "key": "eye_shape", "volatility": "stable" },
  { "key": "eyebrow_shape", "volatility": "stable" },
  { "key": "eyebrow_density", "volatility": "flexible" },
  { "key": "nose_shape", "volatility": "core" },
  { "key": "lip_color_natural", "volatility": "core" },
  { "key": "lip_shape", "volatility": "stable" },
  { "key": "lip_fullness", "volatility": "stable" },

  { "key": "hair_color", "volatility": "core" },
  { "key": "hair_texture", "volatility": "core" },
  { "key": "hair_length_base", "volatility": "stable" },

  { "key": "body_build", "volatility": "stable" },
  { "key": "body_proportions", "volatility": "stable" },
  { "key": "shoulder_width", "volatility": "stable" },
  { "key": "waist_definition", "volatility": "flexible" },
  { "key": "hip_width", "volatility": "stable" },
  { "key": "leg_length", "volatility": "stable" },
  { "key": "neck_length", "volatility": "flexible" },

  { "key": "pelvis_structure", "volatility": "stable" },
  { "key": "pelvis_to_torso_ratio", "volatility": "stable" },
  { "key": "lower_abdomen_shape", "volatility": "flexible" },
  { "key": "glute_shape", "volatility": "stable" },
  { "key": "glute_position", "volatility": "stable" },
  { "key": "glute_definition", "volatility": "flexible" },
  { "key": "leg_structure", "volatility": "stable" },

  { "key": "posture", "volatility": "flexible" },
  { "key": "neck_alignment", "volatility": "flexible" },
  { "key": "hip_alignment", "volatility": "flexible" },
  { "key": "knee_alignment", "volatility": "flexible" }
]
```

## Grill

### Q1
What is the minimum v1 data model you want to treat as first-class persisted entities?

Candidate baseline:
- Character
- CharacterVersion
- TraitEntry
- GroupLockState
- VolatilityLockState
- EditableDraftState
- PreviewSet

### A1
- `VolatilityLockState` is not a separate entity.
- `volatility` is part of the trait definition.
- Locks are editor state, but they must be persisted per character so they are still there when returning later.
- This includes both group locks and UI/assistant-edit filtering behavior.

Interpretation after answer:
- `Character`, `CharacterVersion`, and trait storage are clearly first-class.
- Lock state is persisted per character, but should likely live inside character editor state rather than as a standalone domain entity.
- The confirmed trait-to-volatility mapping above is part of the base specification.

### Q2
Where exactly should the persisted editor state live in v1?

Pick one of these directions, or define your own:
1. `Character` has one current `editorState` blob.
2. `Character` has one current `draft`, and locks live inside that draft.
3. `CharacterVersion` also stores the editor state that existed at save time.
4. Both: current editor state on `Character`, saved snapshot copy on each `CharacterVersion`.

### A2
- Use option 4.
- Keep current live editor state on `Character`.
- Also persist a snapshot copy of editor state on each `CharacterVersion`.

Interpretation after answer:
- Opening a character later restores the current live locks/editor state from `Character`.
- Historical versions also preserve the editor-state snapshot that existed at save time.
- Version save therefore snapshots both trait data and editor-state data.

### Q3
What exactly belongs inside `editorState` in v1?

Candidate fields:
- `groupLocks`
- `uiTraitLocks`
- `lockedVolatilityLevels`
- expanded/collapsed trait groups in UI
- selected preview tab/view mode
- last active version id
- unsaved draft trait edits

### A3
Definitely in `editorState`:
- `groupLocks`
- `uiTraitLocks`
- `lockedVolatilityLevels`
- expanded/collapsed trait groups in UI
- selected preview tab/view mode

Definitely not in `editorState`:
- `lastActiveVersionId`
- unsaved draft trait edits

Interpretation after answer:
- `editorState` is persisted UX/control state, not ephemeral navigation state.
- Draft trait edits should not be auto-restored as persisted editor state in v1.
- Version browsing state is not part of the durable character editor model.

### Q4
What should the editable working state be, if unsaved draft trait edits are not stored in `editorState`?

Choose the intended model:
1. Editing directly mutates a current working trait set on `Character`, and Save snapshots it into a new `CharacterVersion`.
2. Editing happens in a separate transient draft object in memory only, and Save writes it to `Character` plus a new `CharacterVersion`.
3. `Character` always points to a current canonical trait state, and the UI clones that into local session state until Save.

### A4
- Use option 2.
- Editing happens in a separate transient draft object in memory only.
- Save writes that draft into `Character` and also creates a new `CharacterVersion`.

Interpretation after answer:
- Unsaved trait edits are session-local and non-durable.
- `Character` stores only saved canonical current state.
- Save is the explicit boundary that updates canonical state and appends immutable history.
- Cancel/close behavior can safely discard the transient draft.

### Q5
When Save is pressed, should a new `CharacterVersion` be created every single time, even if the saved traits are identical to the current saved character state?

Options:
1. Always create a new version on every Save.
2. Create a new version only if trait data changed.
3. Create a new version if trait data changed, or if editorState snapshot changed in a meaningful way.

### A5 (corrected)
- Use option 2 instead.
- Create a new version only if trait data changed.
- Save button should be enabled only when traits were edited.

Interpretation after corrected answer:
- Versioning is driven only by trait changes.
- `editorState` is persisted separately and snapshotted on versions for historical context, but it does not itself trigger version creation.
- Save is available only for trait edits, not pure editor-state changes.

### Q6
When the user changes only editor state, such as locks or expanded sections, when should that editor state be persisted in v1?

Choose the behavior:
1. Persist immediately on change (auto-save editor state).
2. Persist on explicit separate action, independent from trait Save.
3. Persist only when leaving/closing the editor.

### A6
- Persist editor state only on the Save button.
- In practice this means editor-state changes are persisted only together with a trait-changing save.
- If only editor state changed and traits did not change, nothing is persisted.

Interpretation after answer:
- Save remains the only persistence boundary in v1.
- `editorState` is durable only when bundled with a real trait save.
- Pure lock/UI-state changes are session-local unless a trait edit is also saved.

### Q7
What should happen if the user changes traits, then changes locks/editor state, and presses Save?

Please confirm the intended save payload:
1. Save both the new trait state and the current editorState snapshot together.
2. Save only traits; ignore editorState changes made in that session.

### A7
- Use option 1.
- Save both the new trait state and the current editorState snapshot together.

Interpretation after answer:
- A trait-changing Save snapshots the whole current character editing context.
- Editor-state changes become durable only when bundled with a trait save, and when that happens they are included.
- This keeps persistence simple without adding a separate save channel for editor state.

### Q8
What is the preferred persisted shape for trait data inside `Character` and `CharacterVersion` in v1?

Choose one direction:
1. Store traits as a flat object map, for example `{ "eye_shape": "almond", "hip_width": "wide" }`.
2. Store traits as an array of entries, for example `[{ "key": "eye_shape", "value": "almond" }]`.
3. Store both: canonical object map for runtime, and derived array shape for assistant/export use.

### A8
- Use option 1.
- Canonical persisted storage is a flat object map.
- Any other shape can be derived when needed.

Interpretation after answer:
- Both `Character` current traits and `CharacterVersion` snapshots should use flat key-value maps.
- Assistant/export/import adapters can transform the map into alternate shapes as needed.
- This keeps persistence simple and avoids redundant canonical forms.

### Q9
Where should the authoritative trait metadata live in v1, specifically the fixed trait list, group membership, and the confirmed volatility mapping?

Choose the intended source of truth:
1. In application code as a static schema/config.
2. In database tables/documents.
3. Hybrid: static schema in code for v1, maybe database-driven later.

### A9
- Use option 3.
- Hybrid direction overall, but in v1 the practical source of truth is static schema/config in code.
- Database-driven trait schema can be a later evolution.

Interpretation after answer:
- Trait keys, group membership, and volatility metadata should be implemented code-first in v1.
- Persistence stores trait values and editor state, not the trait taxonomy itself.
- The design should not block a later move to database-driven schema if needed.

### Q10
What should happen if stored character data contains trait keys that are no longer present in the code-defined schema in a future build?

Choose the expected v1 behavior:
1. Silently drop unknown keys on load.
2. Keep unknown keys in persisted data, but hide them from normal UI.
3. Keep unknown keys and show them in a separate unsupported/legacy section.

My current recommendation: option 3 is the safest, because it avoids silent data loss while keeping the main UI clean.

### A10
- Use option 3.
- Keep unknown keys and show them in a separate unsupported/legacy section.

Interpretation after answer:
- No silent data loss for legacy/unsupported trait keys.
- The main character editor remains schema-driven and clean.
- Migration pressure is reduced because old data can still be preserved and inspected.

### Q11
What should the `Character` entity minimally contain in v1, apart from traits/editor state/version links?

Candidate fields:
- `id`
- `name`
- `gender`
- current saved `traits`
- current saved `editorState`
- `currentVersionId`
- `createdAt`
- `updatedAt`
- `deletedAt` / soft delete
- preview status summary

My current recommendation:
- definitely yes: `id`, current saved `traits`, current saved `editorState`, `currentVersionId`, `createdAt`, `updatedAt`
- likely yes: soft delete if character list management matters soon
- probably no on entity root: duplicate `name` and `gender` outside traits, unless you specifically want denormalized indexing/display
- preview status summary could be useful, but may belong to preview subsystem later

### A11
Put all listed candidate fields directly on `Character` in v1:
- `id`
- `name`
- `gender`
- current saved `traits`
- current saved `editorState`
- `currentVersionId`
- `createdAt`
- `updatedAt`
- `deletedAt`
- preview status summary

Interpretation after answer:
- `Character` is intentionally denormalized for practical list/view usage.
- Name and gender are first-class top-level fields even though overlapping data may also exist in traits.
- Preview summary is considered useful enough for the root entity in v1.
- Soft delete is in scope for v1.

### Q12
What should be on `CharacterVersion` in v1?

Candidate fields:
- `id`
- `characterId`
- `traitsSnapshot`
- `editorStateSnapshot`
- `versionNumber`
- `changeSummary`
- `createdAt`
- `createdByAssistant` / `createdByUser`
- `parentVersionId`

### A12
Definitely on `CharacterVersion`:
- `id`
- `characterId`
- `traitsSnapshot`
- `editorStateSnapshot`
- `versionNumber`
- `changeSummary`
- `createdAt`

Definitely not needed in v1:
- `createdByAssistant` / `createdByUser`
- `parentVersionId`

Interpretation after answer:
- `CharacterVersion` stays compact and linear in v1.
- No authorship metadata and no explicit version graph/branching model yet.
- History is modeled as ordered immutable snapshots with summaries.

### Q13
What should `changeSummary` be in v1?

Choose the intended form:
1. Plain free-text summary only.
2. Structured diff only.
3. Both: structured diff for logic + human summary text for UI.

My recommendation: option 3 is strongest if you can afford it, because UI and logic often want different shapes. But option 1 is the cheapest v1.

### A13
- Use option 1 in v1: plain free-text summary only.
- Desired future direction: the summary should ideally be generated by the connected model.
- Model-generated summary is postponed because it would require background queueing / async processing.

Interpretation after answer:
- `changeSummary` is a lightweight human-readable field in v1.
- No structured diff storage is required yet.
- AI-authored version summaries are explicitly a future enhancement, not part of the first implementation.

### Q14
Who writes `changeSummary` in v1?

Choose the behavior:
1. User must enter it manually on every Save.
2. System auto-generates a deterministic plain-text summary from the trait diff.
3. Optional user field, otherwise system auto-generates deterministic summary.

My recommendation: option 3 is the best UX if you want decent summaries without forcing extra typing, while still avoiding AI/background complexity.

### A14
- Use option 3.
- User may provide a custom summary.
- Otherwise the system auto-generates a deterministic plain-text summary from the trait diff.

Interpretation after answer:
- Save flow should support an optional custom summary field.
- Summary generation stays synchronous and deterministic in v1.
- Future AI-generated summaries can replace the deterministic fallback later without changing the data model.

### Q15
How should deterministic fallback `changeSummary` be formatted in v1?

Choose the preferred style:
1. Very short sentence, for example: `Updated eye_shape, lip_shape, and hip_width.`
2. More descriptive sentence using old/new values where possible, for example: `Updated eye_shape from round to almond; hip_width from narrow to wide.`
3. Compact bullet-like string, for example: `eye_shape: round → almond; hip_width: narrow → wide`.

My recommendation: option 3 is usually the best balance, because it is deterministic, compact, and informative without needing natural-language generation.

### A15
- Use option 3.
- Deterministic fallback summary format is a compact diff-style string.
- Example: `eye_shape: round → almond; hip_width: narrow → wide`.

Interpretation after answer:
- Version history remains compact and explicit.
- Summaries are easy to generate from trait diffs without AI.
- UI can show version summaries without additional formatting logic.

### Q16
What are the allowed creation paths for a new `Character` in v1?

Candidate paths:
1. Create empty/new character manually.
2. Create from import text parse flow.
3. Create from cloning an existing version into a new character.
4. Create from generated preview/reference package.

My recommendation for v1:
- definitely yes: 1, 2, 3
- probably no for now: 4, because preview/reference is still a later subsystem

### A16
Definitely in v1:
- Create empty/new character manually.
- Create from import text parse flow.
- Create from cloning an existing version into a new character.

Definitely not in v1:
- Create from generated preview/reference package.

Interpretation after answer:
- Character creation is centered on direct authoring, text import, and version-based branching into a new entity.
- Preview/reference remains downstream of character definition, not a source-of-truth creation path.

### Q17
What should delete mean for `Character` in v1?

Choose the intended behavior:
1. Soft delete only, recoverable later.
2. Hard delete immediately.
3. Soft delete in normal UI, optional permanent delete later.

My recommendation: option 3 is the safest product choice if you're already putting `deletedAt` on `Character`.

### A17
- Use option 3.
- Normal UI delete is soft delete.
- Trash / permanent deletion management will be specified later as a separate concern.

Interpretation after answer:
- `deletedAt` is meaningful and active in v1.
- Deletion safety is prioritized over immediate destructive removal.
- Character lifecycle will later include a separate trash-management flow.

### Q18
When cloning an existing version into a new character, what should be copied in v1?

Candidate copy set:
- `traitsSnapshot` from the source version
- `editorStateSnapshot` from the source version
- preview status summary
- preview sets themselves
- source version reference metadata

My recommendation:
- definitely copy: traitsSnapshot, editorStateSnapshot
- probably do not copy: preview sets themselves
- source version reference metadata is useful only if you want visible provenance now; otherwise skip in v1

### A18
Definitely copied:
- `traitsSnapshot` from the source version
- `editorStateSnapshot` from the source version

Definitely not copied:
- preview status summary
- preview sets themselves
- source version reference metadata

Interpretation after answer:
- Cloning creates a new character definition starting point, not a copy of downstream generated artifacts.
- Provenance is not modeled explicitly in v1.
- Clone behavior is intentionally simple and deterministic.

### Q19
When creating a character from import text parse flow, what should happen immediately after the user confirms the parsed result?

Choose the intended sequence:
1. Create `Character` plus initial `CharacterVersion` immediately.
2. Create only a transient draft first, require explicit Save to create the first version.
3. Create `Character` immediately, but first version only after separate Save.

My recommendation: option 1 is the cleanest, because confirmation of import is already a deliberate creation act.

### A19
- Use option 1.
- After import confirmation, create both `Character` and initial `CharacterVersion` immediately.

Interpretation after answer:
- Import confirmation is treated as a commit-worthy creation event.
- Imported characters start with real history from version 1.
- No extra save step is required after confirmed import.

### Q20
What should happen in the manual "create new character" flow before the first save?

Choose the intended behavior:
1. Opening "new character" creates nothing persisted until the user saves.
2. Opening "new character" immediately creates a persisted empty `Character` draft.
3. Opening "new character" immediately creates both empty `Character` and initial empty version.

My recommendation: option 1 is the cleanest and avoids clutter from abandoned empty characters.

### A20
- Use option 1.
- Opening "new character" creates nothing persisted until the user saves.

Interpretation after answer:
- Manual creation uses a fully transient pre-save draft.
- Persistence begins only at the first explicit Save.
- Empty abandoned create flows do not pollute storage.

### Q21
What are the minimum trait requirements for the first successful Save of a manually created character in v1?

Candidate policies:
1. Only `name` is required.
2. `name` and `gender` are required.
3. No required traits, completely empty character can be saved.
4. Custom rule: please define.

My recommendation: option 1 or 2. I lean toward option 1 if you want flexibility, but option 2 if gender is foundational for your character model and UI identity.

### A21
- Use option 1.
- Only `name` is required for the first successful Save.

Interpretation after answer:
- Character creation stays lightweight.
- `gender` is important data, but not required to establish the initial character entity.
- Validation can stay minimal in v1 while still preventing unnamed characters.

### Q22
For imported characters, if the parser returns `name = null`, should the user be blocked from confirmation until they provide a name?

Choose the intended behavior:
1. Yes, block confirmation until a name is supplied.
2. No, allow nameless import and let user fix later.
3. Auto-generate a temporary name.

My recommendation: option 1 is the cleanest, because it keeps the creation rule consistent with manual save: no character should be created without a name.

### A22
- Use option 1.
- Block import confirmation until a name is supplied.

Interpretation after answer:
- No persisted character may be created without a name.
- Manual creation and import creation follow the same minimum identity rule.
- Import UI needs a correction path for missing name before final confirmation.

### Q23
How should the assistant edit flow apply changes in v1?

Candidate behaviors:
1. Assistant proposes patch, user must explicitly confirm before applying to the draft.
2. Assistant patch applies directly to the transient draft immediately.
3. Mixed: auto-apply by default, but require confirm for some cases.

My recommendation: option 1 is the safest and most legible for a character-definition editor, especially early on.

### A23
- Use option 2 in v1.
- Assistant patch applies directly to the transient draft immediately.
- Confirmation/review step can be added later if UX proves it is needed.

Interpretation after answer:
- Assistant is treated as a draft editor, not as a save author.
- Risk is limited because changes stay in transient draft until explicit Save.
- The UI should still visibly mark changed traits so the user can review what happened before saving.

### Q24
After assistant patch auto-applies to the transient draft, how should the UI show what changed in v1?

Candidate behaviors:
1. Only update the fields silently.
2. Highlight changed traits in the editor until the next Save/Cancel.
3. Highlight changed traits and also show a compact change list near the assistant input.

My recommendation: option 3 is the best UX if affordable, because silent changes are easy to miss and field-only highlight can still be too subtle.

### A24
- Use option 2.
- Highlight changed traits in the editor until the next Save or Cancel.

Interpretation after answer:
- Assistant edits remain visible without adding extra UI panels.
- The editor itself is the main review surface for transient assistant changes.
- Save/Cancel become the natural boundary for clearing the changed-state indicators.

### Q25
What should happen if the assistant patch tries to modify a trait that is excluded by current locks/filtering in v1?

Choose the intended behavior:
1. Backend/frontend silently drops those changes.
2. Drop those changes and show a small note like `Some locked traits were skipped.`
3. Treat the whole assistant patch as failed.

My recommendation: option 2 is the best balance. It keeps the flow smooth, respects locks, and still tells the user why some expected edits may not have happened.

### A25
- Use option 2.
- Drop locked/excluded changes and show a small note that some locked traits were skipped.

Interpretation after answer:
- Locks are enforced robustly without breaking the assistant interaction.
- Partial assistant success is acceptable in v1.
- The UI should communicate skipped changes at a lightweight notification level.

### Q26
What should the assistant receive as character context in v1?

Choose the intended input shape:
1. Only the editable subset of current traits.
2. Editable subset plus separate metadata listing which groups/volatility classes are locked.
3. Full current traits, but mark non-editable ones as read-only.

My recommendation: option 1 is the simplest and matches your earlier direction, but option 2 may produce better edits because the assistant can understand what is intentionally constrained without seeing forbidden values as editable input.

### A26
- Use option 1.
- The assistant receives only the editable subset of current traits.

Interpretation after answer:
- Assistant context is intentionally minimal.
- Lock enforcement happens before prompt assembly, not inside model reasoning.
- Simplicity is prioritized over richer contextual awareness in v1.

### Q27
What should the assistant response contract minimally contain in v1, now that auto-apply is chosen?

Current candidate fields:
- `summary`
- `action`
- `changes`
- `requires_user_confirmation`

My recommendation for v1 after the latest decisions:
- keep: `summary`, `action`, `changes`
- drop: `requires_user_confirmation` for now, because auto-apply into draft is the chosen flow

### A27
- Yes, remove `requires_user_confirmation` from the v1 assistant contract.
- Keep only `summary`, `action`, and `changes`.

Interpretation after answer:
- Assistant contract now matches the actual interaction model.
- Response shape stays lean and easier to validate.
- Confirmation semantics can be reintroduced later if the UX evolves toward patch review.

### Q28
Do you want to keep grilling now into the import parser contract and exact UI flow details, or stop here and have me synthesize the current grill log into a clean draft spec next?

My recommendation: stop here for now and synthesize, because we already have enough architectural decisions to turn this into a strong v1 spec skeleton without overfitting unfinished subsystems.
