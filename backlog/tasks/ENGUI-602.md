# ENGUI-602 — MCP Character tags and discoverable prompt guidance

## Status
In Progress

## Request
Owner14774 approved extending Character references to MCP after a prepared plan retained a literal tag. Make prompt capabilities discoverable to agents. Prompts/Prompt Constructor remains excluded. No paid generation.

## Scope
- Reuse the workspace-scoped Character resolver for both tag modes, including wildcards/Vibes and seeded choices. Freeze source template and reference provenance; descriptions remain literal text.
- Explicit-tag prompts do not prepend primary identity/outfit; characterId remains the primary tracking character. Reject conflicting historical identity/explicit outfit selection and tags in negativePrompt.
- Detect changed reference sources before dispatch; never rewrite old plans. Legacy unresolved-tag plans require a new prepare.
- Publish startup instructions, a read-only prompt guide and paginated workspace wildcard discovery.

## Acceptance
- SDK integration tests: both modes, multiple characters, deduplication, workspace isolation, malformed/missing/outfit errors, literal text, choices, wildcards/Vibes, stale sources, legacy plans and mocked provider payload.
- No-tag compatibility; discoverable guidance; isolated production build, commit/push, promotion and live read-only smoke. No production fixtures or paid generation.

## Rollback
Keep previous .next before promotion; restore and restart engui-studio.service if needed. No database migration or credential change.

## Candidate verification
- 92 focused tests pass across five files, including 18 new real-SDK cases and encrypted mocked-provider payload proof. Clients discover schemas before calls so error-result validation is exercised.
- Real production-build HTTP SDK: 10 checks pass (instructions, 25 tools, guide/resource, wildcard discovery, both tag modes, multiple characters and actionable error after discovery). No generation batches in the HTTP fixture.
- Isolated production build passed. TypeScript remains at the same 125 normalized baseline diagnostics; none added.
- Test harness uses fresh schema-only databases with synthetic records/settings, no production data or credentials. Operational protected-Default triggers are omitted only in the legacy-suite fixture because it creates a synthetic protected workspace. Initial fixture reuse/name problems corrected; evidence retained in the run directory.
- Fixed an existing MCP error-format incompatibility exposed by real SDK discovery: error results no longer attach success-schema-incompatible structuredContent.
- Run artifacts: /home/engui/engui-runs/engui-602-20261124. No paid generation; Prompts unchanged.
