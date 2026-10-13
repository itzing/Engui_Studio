# Framing-aware character looks
Status: Approved option 2; implementation in ENGUI-559–561.
## Problem
Character previews replace the old framing filter with a flattened wardrobe prompt. Portraits consequently describe shoes and hems. Studio also appends a full-body helper regardless of pose framing.
## Contract
A deterministic shared compiler selects region-scoped identity and outfit fragments. Framing and pose lead the prompt; visible identity and costume follow; environment and style come last. No runtime LLM and no paid validation.
Regions: identity (age/gender/skin only), face, hair, headwear, neck, shoulders, torso, waist, arms, hands, hips, legs (to knees), lower_legs, feet. Long garments must be split into independently phrased fragments. A fragment never implies an unseen garment extent.
Framings: closeup, portrait (head and shoulders), half_body (waist up), three_quarter (to knees), full_body. Every framing retains the entire head/headwear and headroom. Full body retains feet. Portrait metadata may add arms/hands raised into the crop without zooming out.
A covering helmet hides face/hair descriptors but preserves exposed lower-face anatomy. Permanent anatomy is identity, detachable equipment is outfit. Inventor's left empty socket and separate right-hand tool stay distinct whenever visible.
## Storage and editing
Identity fragments reside in versioned character editorState, tied to the source traits and gender. Outfit fragments reside in versioned outfit metadata tied to description/constraints. Existing full descriptions remain available as source/provenance.
Each part has a region, text, and optional exposed-face flag. Stale source fingerprints invalidate previously classified parts. Built-in traits can be classified deterministically; unknown or mixed legacy fragments require review for cropped framing rather than silently leaking full-body text or losing essential details. Full-body fallback preserves source text.
Custom outfits support the same parts editor. Pose metadata records extra visible regions, separately from framing. Editors are responsive and shared by desktop/mobile.
## Studio and history
New runs pin structured look snapshots. New shot revisions compile from the pinned snapshot and pose metadata. Launch uses that same framing, not a second full-body text decision. Krea2 remains text-only; Z-Image retains its control-image path.
Existing completed previews, runs, shot revisions and job prompts are immutable. Only pristine Showdown drafts without revisions/results may receive equivalent structured snapshots in the migration; executed runs retain their history. New runs from existing sessions receive the corrected compiler.
## Migration
Curate all seven Showdown characters and their default outfits. Preserve originals and old versions. Add minimal JSON metadata columns where no suitable versioned JSON field exists. Migration is idempotent, scoped, transactional and rehearsed on a SQLite copy. Other workspaces and prior results are unchanged.
## Verification
Offline tests for every crop, hands-near-face, helmet, prosthesis, custom/neutral looks, stale classification and snapshot preservation. Dry-run prompt inspection without generation. Desktop/mobile responsive checks. Back up before production migration, build/restart and verify health. Text conditioning reduces conflicts but does not guarantee pixel-perfect framing.
