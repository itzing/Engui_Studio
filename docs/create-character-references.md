# Live Character references in Create

## Scope
ENGUI-601. Supported only in Create Image and Create Video on desktop and mobile. Prompt Constructor (Prompts), Studio, Batch Cards and MCP do not opt in. No migration of stored prompts or historical generated work.

## Authoring
- `{character:UUID}` inserts the current Character identity, excluding costume traits.
- `{character:UUID:withOutfit}` adds its current default outfit. A specific wardrobe selector is out of scope.
- Type `{` and search by name, or use Insert character. Include outfit controls the inserted tag. UUID references survive renames; source text is never replaced with a cached description in the editor.
- Identity-only does not imply nudity. Write scene-specific clothing separately.
- Legacy default clothing traits remain supported when no separate default Outfit was assigned. An absent or unavailable requested outfit produces an actionable error.

## Rendering and persistence
Create clients send `enableCharacterReferences=true`. The shared Create renderer expands existing wildcards, protects Character references while selecting seeded alternatives, and inserts the selected characters last. Descriptions are literal and are not recursively interpreted. References in wildcard values and alternative groups are supported. The explicit `character:` namespace takes precedence over an identically named wildcard only in this opted-in path.

Lookup is restricted to the active workspace and non-deleted characters. A single lookup supplies all repeated references for one submission. Persist the original `promptTemplate`, actual `resolvedPrompt`, seed, wildcard decisions and `characterReferences` snapshots (ID, name, Character version/update time, outfit ID/revision, exact inserted text). Existing encrypted provider payloads use the resolved text. No database schema change.

Preview uses the same renderer and current saved data without persisting wildcard cursors or starting jobs. Fixed seed/unchanged inputs produce the same text; Randomize and subsequent Character edits may change the eventual generation. New renders, including Reuse, consult current saved cards. Jobs/Gallery retain historical template and resolved text; existing transport retries retain their already-built payload.

## Limits and errors
Malformed tags, missing/deleted/cross-workspace references, or unavailable requested default outfits fail before provider dispatch. At most 32 distinct referenced characters and 100,000 input/output characters. Unrecognized ordinary wildcard syntax keeps its existing behavior.

## Validation and rollback
Resolver, UI, Create submission and scoped HTTP integration tests use fixtures only. Browser checks cover Chromium/WebKit and desktop/mobile. Keep the previous production build for rollback; restore it and restart the service if needed. No paid generations are required for validation.
