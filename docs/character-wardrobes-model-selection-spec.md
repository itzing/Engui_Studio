# Character Wardrobes and Image Model Selection

Status: Approved for implementation, 2026-10-13. Surfaces: desktop and mobile.

## Goals
Separate physical identity from clothing so Showdown characters can change outfits without conflicting prompt instructions. Reuse complete outfits within a workspace. Select Z-Image or Krea2 Turbo for character previews, Studio runs and pose-library previews. Preserve existing content and historical outputs.

## Domain and ownership
- Character contains physical appearance, hair, permanent anatomy and personal traits. Permanent prostheses are identity; removable tools and clothing are outfit content.
- Outfit is one complete ensemble, with description and constraints, not an item inventory. It belongs to one workspace and is either shared within that workspace or personal to one character.
- Wardrobe links a character to available outfits; one outfit may be the default. Linking a shared outfit does not duplicate it. A personal variant is an explicit copy.
- No cross-workspace sharing is introduced. Personal outfits cannot be assigned to other characters. Archived outfits cannot be newly selected; immutable run/preview snapshots remain readable.
- Every API, nested reference, list, preview and deletion path enforces workspace ownership.

## Look resolution
A look consists of identity plus exactly one selected costume: Character default, Choose outfit, Custom outfit, or Neutral anatomy (previews only). Custom outfits replace default clothing. Neutral anatomy explicitly uses simple fitted swimwear; it is never the implicit Showdown preview mode. Unclassified custom traits are preserved.

Use one resolver for preview submission, Studio snapshots and character selection in Prompts. Resolve outfit changes per character slot, not globally. Existing manually edited prompt text is preserved until the user explicitly applies a character/look. Saving an outfit never rewrites old prompts or runs.

## Wardrobe UI
Provide workspace outfit library and a wardrobe inside Characters. Users can create/edit/archive shared or personal outfits, link shared outfits, make a personal copy and choose a default. Desktop and mobile offer equivalent actions. UI labels and authored documentation are English.

## Character previews
Keep Portrait, Upper body and Full body. Add model and look selection. Default outfit is the initial mode; users explicitly choose Neutral anatomy. Hide contradictory visible-eyes/face requirements when costume conceals the face (Protector). Persist each generated look/model/version separately with the exact prompt, identity, outfit and generation settings. Regenerating a slot may update that same look but cannot erase another look's previews. Existing preview URLs remain accessible.

## Studio
Session brief offers Character default, Choose outfit and Custom outfit. Runs snapshot resolved identity/outfit and model settings at creation. Editing a library outfit or a character affects new runs only, not prepared/running/history. Run settings may select Z-Image or Krea2 Turbo when no shots are active. Krea2 uses the pose text only, never OpenPose or ControlNet; Z-Image retains its existing pose path. LoRA choices are filtered and validated for both workspace access and base-model compatibility. Default steps: Z-Image 9, Krea2 Turbo 8; CFG 1. Never silently fall back to another paid model.

## Pose library and errors
Single and bulk previews expose the same model selection and capture effective settings. Keep bulk confirmation. Seed categories once per workspace, atomically and idempotently, including concurrent first reads; do not resurrect intentionally deleted categories. Explain ENDPOINT_PAUSED in the UI. Do not enable paused endpoints automatically.

## Showdown migration
Use explicit six-character IDs, never names alone. Preserve original source import and all CharacterVersion records. Move known costume traits to a personal `<Character> — Original` outfit and make it default. Preserve unknown traits and permanent prosthetic anatomy. Gambler hair becomes pale warm golden/champagne blonde, long and straight with an off-center part. Protector helmet/face concealment belongs to costume. Inventor's empty left docking socket is permanent; the separate right-hand tool is equipment.

Migration is additive, lossless and repeatable. Preserve the previous trait object in migration evidence and historical versions. Pin any existing Studio snapshots which otherwise resolve character traits dynamically before moving traits. Do not modify saved Prompts/Scenes or completed gallery outputs. All other workspace characters retain their current behavior. Default workspace is untouched and protected.

## Verification and rollout
Test ownership and personal/shared access, default uniqueness, replacement semantics, archived references, preview isolation, model defaults/LoRA validation and Krea2 text-only poses. Rehearse on a consistent copy of the database; compare original content and counts, then run the migration twice. No paid generations are used for validation. Before production cutover take a fresh SQLite backup, stop writers for schema/data migration, run the production build and restart the service. Roll back code and the matching pre-migration database together if verification fails. A same-disk backup is authorized.

## Non-goals
No item-by-item wardrobe system, outfit transfer across workspaces, automatic image generation, OpenPose for Krea2, new provider integration, or retroactive rewriting of existing prompts/history.
