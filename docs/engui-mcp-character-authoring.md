# MCP character authoring (ENGUI-589)

## Scope and workflow

Server-only extension of the existing workspace-bound MCP. Existing Character, CharacterVersion and Outfit records remain canonical; no separate concept card or UI is introduced. The workflow is create character, prepare/generate variants, review, partially update the character, prepare a fresh plan and repeat. Authoring never submits inference.

## Contract

Add eight tools: engui_create_character, engui_update_character, engui_list_character_versions, engui_get_outfit, engui_create_outfit, engui_update_outfit, engui_get_wardrobe and engui_update_wardrobe. All writes require the existing curate scope and a UUID requestKey. Existing Fairy Tale credentials already contain that scope; no token rotation or connection changes.

Character updates require editRevision from a fresh character/wardrobe read. Traits merge by key; null deletes only the specified key. Omitted fields and unrelated editor state are preserved. Identity classification can be supplied as bounded visible-detail parts; the server computes its source binding. Changing identity without replacement parts invalidates old classification. Outfit updates require expectedRevision; wardrobe changes require editRevision. Personal outfits cannot be assigned to another character or workspace.

Each identity edit creates a new CharacterVersion, with a nullable additive identitySnapshot column containing name and gender in addition to existing traits/editor snapshots. Existing UI version writers also capture identity. Older versions without identity metadata report that incompleteness; historical generation must not silently borrow a changed current identity. A current version can use the current identity. Old prepared plan JSON and generated artifacts remain unchanged.

## Verification and rollout

Use an isolated database, official SDK and mocked provider. Cover partial updates, clearing traits, duplicate request keys, stale/concurrent changes, cross-workspace IDs, read-only credentials, classification, outfits/default selection, history and old-plan immutability. Validate the additive migration on a database copy, build in isolation, deploy with a retained previous build, and verify public discovery/read-only context. Never launch paid validation jobs.

## Client workflow

1. Call `engui_create_character` with a name, optional male/female/null gender, traits and a fresh UUID `requestKey`. Omitted gender is null, not a guessed value. Save the returned character ID.
2. Read `engui_get_character`. Its `editRevision` is the concurrency token; it is separate from the immutable `characterVersionId` and generation `digest`.
3. Optionally create an outfit, read `engui_get_wardrobe`, then use `engui_update_wardrobe` with `action: "default"` and the latest `editRevision` as `expectedRevision`. Personal outfits are linked automatically, but not selected by default.
4. Prepare a generation with the character ID. Inspect exact prompts/seeds/settings before starting authorized paid work. Review results and record an approval only when the owner selected it.
5. Read the current character again, then call `engui_update_character` with a partial `changes` object. A new identity version is created; old plans, images and review snapshots stay unchanged. A no-op returns `changed: false` without an extra version.
6. Prepare a fresh generation, optionally linking its `parentBatchId` to the previous round. Existing plans using the changed current identity are stale and must not be started.

Example partial edit (replace placeholders with actual values):

```json
{
  "characterId": "<character-id>",
  "expectedRevision": "<editRevision-from-latest-read>",
  "changes": {
    "traits": { "hair_color": "silver", "facial_hair": null }
  },
  "changeSummary": "Review: silver hair, no facial hair",
  "requestKey": "<fresh-UUID>"
}
```

The example changes only hair color and removes only the facial-hair trait. Other traits, locks, preview state and UI preferences are retained. Every retry of the same operation must reuse its original requestKey and identical payload. After `REVISION_CONFLICT`, read the latest record and decide the patch again with a fresh key; never silently overwrite it.

### Visible-detail classification

`identityParts` on characters and `visibleParts` on outfits accept arrays of `{region, text, exposed?}`. Use the regions advertised in the tool schema. The server binds the classification to the resulting identity/outfit text; clients do not invent a source hash. null clears classification. Changed text without replacement parts clears stale metadata. A cropped prompt may require complete classification; full-body preparation keeps the existing compiler behavior and reports warnings. No helper-model inference is triggered by editing.

### Historical identity and clothing

`engui_list_character_versions` returns captured identity, traits and classification with version numbers and an opaque cursor. `engui_get_character` accepts optional `characterVersionId` for a captured historical identity. Historical reads return `editRevision: null`; always read the current card before writing. A version predating name/gender capture reports `identityComplete: false`; selecting it for historical generation fails with `VERSION_INCOMPLETE` instead of using a changed name/gender.

Character versions capture identity, not a frozen wardrobe. Outfits have their own revisions. A historical identity read uses current outfit selection; an immutable generation plan contains the exact identity, outfit, prompt and settings used for that result. Setting/clearing defaults or editing an outfit never rewrites old plans. There are no delete-character, delete-outfit or silent rollback tools in this extension.

### Permissions and discovery

The server advertises version 1.1.0 and 23 tools for a read/generate/curate/cancel credential; a read-only credential sees 13 tools. Five new authoring writes require `curate`; the other three new tools are read-only. Reconnect/refresh the existing Claude connector to refresh discovery. The URL, workspace header and credential do not change.

### Additive migration

```sh
python3 scripts/mcp/migrate-character-authoring.py --database /absolute/path/database.db --backup /private/path/pre-character-authoring.db
npm run db:generate
```

Run after the original MCP migration and before starting the new build. It adds only nullable `character_versions.identitySnapshot`, tracks its checksum and leaves old rows unchanged. UI character creation, gender edits and name edits also capture identity metadata in new versions. Rollback to the previous build does not require dropping the added column or restoring a database over later user work.
