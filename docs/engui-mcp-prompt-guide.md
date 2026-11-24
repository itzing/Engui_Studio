# Engui MCP prompt guide

## Start here
1. Call engui_get_context to verify the fixed workspace and permissions. Use engui_list_models, engui_list_characters, engui_get_character and engui_list_presets to discover real IDs; never invent IDs or infer model health from configured=true.
2. Edit Character cards and default outfits with authoring tools when the owner requests lasting changes. Use a fresh editRevision/expectedRevision and UUID requestKey. Omitted fields are preserved; null removes a trait. Read again after revision conflicts.
3. Call engui_prepare_generation. It freezes exact prompts, references, settings and seeds (three variants by default) WITHOUT paid inference. Inspect snapshot.variants and warnings.
4. Call engui_start_generation only with conversation authorization for this paid generation, the exact planId/planDigest and a UUID requestKey. Retry the SAME operation with the SAME key and payload. Poll engui_get_batch using pollAfterSeconds; never blindly resubmit uncertain work.
5. Review actual images with engui_get_image. Completed originals are preserved to Draft. Record an approved reference only after the owner selects it.

## Two prompt modes
Structured mode (no Character tags): characterId is required; the server prepends its selected identity and outfit. Optional characterVersionId selects captured historical identity; outfitId selects clothing, otherwise current default clothing is used. Put action, camera, environment and style in prompt, not a second hardcoded identity.
Inline mode (one or more Character tags, including tags from a wildcard or Vibe): descriptions are inserted ONLY at their tag locations. No implicit identity or outfit is prepended. characterId remains required as the primary character for batch/review tracking; tag every person you want visible. Omit characterVersionId and outfitId in this mode; conflicting parameters are rejected rather than ignored.

## Character syntax (positive prompt only)
- {character:UUID}: current Character identity, WITHOUT clothing text; this does not mean nude.
- {character:UUID:withOutfit}: current identity plus CURRENT DEFAULT outfit. Missing/unavailable default outfit is an error; select one in Characters/wardrobe or use identity-only.
- Discover UUIDs via engui_list_characters. Multiple characters and repeated tags are supported within the fixed workspace, up to 32 distinct characters. Repeated tags use the same frozen source per preparation.
- Example: {character:PRIMARY_UUID:withOutfit} faces {character:RIVAL_UUID}. A wide shot in a rainy courtyard.
- UUID placeholders in examples must be replaced with real IDs. Unknown, deleted, foreign or malformed Character references fail with INVALID_CHARACTER_REFERENCE; no plan is saved. Negative prompt tags are rejected explicitly.
- Tags use full current identity text, not automatic region-cropped identity classification. Choose framing/action deliberately. Appearance text is literal: its braces and dollar signs are not evaluated recursively.

## Wildcards and seeded alternatives
Call engui_list_wildcards (query/cursor/limit) for active keys and values in this workspace. This read does not create defaults or edit wildcards.
- {key} expands a stored wildcard. {key:variantText} selects a matching value; {key:0,2} selects zero-based alternatives. MCP does not offer a persistent sequential cursor.
- {red|blue} chooses one alternative deterministically per seed. Character tags inside alternatives are protected before selection and inserted afterwards.
- Vibe text and wildcard expansion happen before seeded choices; all referenced Character tags in the expanded template must be valid, including alternative branches.
- Unknown ordinary wildcard keys remain literal text for compatibility: inspect the exact prepared prompts. Do not invent keys.

## Provenance, errors and reuse
The original source is snapshot.draft.prompt. snapshot.stages.expandedPrompt is the expanded TEMPLATE and can still contain tags. Actual provider prompts are snapshot.variants[].prompt.
Character substitutions are recorded separately in snapshot.characterReferences, snapshot.stages.characterReferences and each variant.characterReferences, including token, Character version, optional outfit revision and resolved text. wildcardReplacements is ONLY the ordinary wildcard log; an empty list does not mean Character resolution failed.
Plans are immutable. Edited/deleted referenced characters or changed default outfits invalidate an unstarted plan with PLAN_STALE; prepare again using a NEW requestKey. Historical plans and already-generated images are never rewritten. Legacy unresolved-tag plans must be prepared again. Do not start a plan containing an unintended literal tag.
This syntax works in MCP and Create Image/Create Video. Prompts/Prompt Constructor has no tag expansion; its existing Characters workflow remains separate. MCP currently exposes image generation, not Create Video's full API.
