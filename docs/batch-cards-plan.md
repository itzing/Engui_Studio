# Batch Cards — ENGUI-595

## Product behavior
Desktop-only `/batch-cards`, accessible from the main desktop navigation. A workspace can contain multiple named batches. Paste a complete JSON array with 3–5 variants per `n`; import is atomic and never starts generation automatically. All original row fields, unknown properties and exact prompt text survive export; lowercase `pick` reflects current choices.

A searchable sidebar provides class, ready and unfinished filters and previous/next navigation (arrow keys outside text inputs). The comparison grid shows card name, effect, class icon, variant label, route, style pack, prompt and result. Copy name copies only the card title. Checkboxes select attempts for generation across cards; Pick chooses a single finished result. Imported Picks are retained but readiness requires a completed current result. Regenerating a picked attempt clears its Pick. Per-card JSON replacement clears that card's current task links and Picks, increments its revision, cancels queued old attempts and leaves other cards intact. An already submitted old job may finish in history, but cannot become a result of the replacement card.

Original white RGBA PNGs from the owner's `class-icons.zip` are CSS alpha masks tinted using currentColor: Gambler/dice, Protecter/shield (archive filename protector), Rebel/fist, Cheater/mask, Bureaucrat/gavel, Inventor/flask. No JPEG reconstruction remains. Unknown classes get a neutral fallback glyph.

## Persistence and generation
- `CardBatch`: workspace owner, title, compare-and-swap revision, source document and independent generation settings.
- `CardBatchTask`: immutable prompt/settings/LoRA/seed snapshot, card revision, request-key receipt, preallocated job ID, dispatch lease/provider boundary, durable original output URLs.
- API: GET/POST `/api/batch-cards`; GET/PATCH `/api/batch-cards/:id`, GET `?export=true` for the original flat array. All operations use workspace guards. Stale mutations return 409, never overwrite a newer document.
- New batches default to Krea2 Turbo, 1024×1024, eight steps, CFG 1, no LoRAs and random seeds. Settings apply to new attempts only. The imported prompt is submitted exactly through the existing prepared-generation pathway; it is not expanded as a Vibe or wildcard template.
- Background worker dispatches one attempt per workspace cycle, bounds provider-side active jobs to 40, and resumes after tab closure/server restart. Duplicate receipt keys cannot double-submit. Ambiguous provider acceptance is never retried automatically.
- Completed originals are copied to registered workspace-owned batch storage. Jobs history can be cleaned after preservation without destroying card results. Regenerated/superseded files remain historical; this feature does not delete original outputs.
- Workspace deletion cancels waiting batch tasks and blocks final cleanup while a paid submission is uncertain. Composite owner FK and ownership inventory cover new records.

## Validation
Pure parsing/round-trip/settings tests and isolated SQLite service/worker/API tests cover active duplicate rejection, stale revisions, replacement during dispatch, late old results, uncertain acceptance after interruption, explicit provider rejection, workspace isolation and output retention after job removal. Provider access is replaced with a fake and network is prohibited in service tests.

Chromium and WebKit workflow checks intercept all API requests and external requests. They cover imports with three/five variants, search/filter/navigation, single/multiple generation, cross-card selection, Pick, reload, copy title, settings, replacement, save failure, original-alpha icons, full-size preview and JSON download. No paid test generations or live gallery changes.

## Deployment and rollback
Additive SQL is `prisma/migrations/20261122_batch_cards.sql` (deliberately tracked despite the legacy migrations ignore rule). Rehearse on an online snapshot, verify integrity and foreign keys, then take a fresh online production backup and run in an explicit transaction. Build separately from the live `.next`, retain previous build, promote and restart `engui-studio.service`. A previous build tolerates the extra tables. Roll back the build rather than restoring an old DB over newer job activity.
