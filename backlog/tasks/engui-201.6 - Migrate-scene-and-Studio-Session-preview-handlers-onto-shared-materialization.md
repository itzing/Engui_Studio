# engui-201.6 - Migrate scene and Studio Session preview handlers onto shared materialization

## Summary
Adopt the shared materialization framework in other generated-artifact flows after the character preview path proves stable.

## Scope
- Migrate scene preview attachment off client-owned finalization.
- Plan and execute convergence of Studio Session materialization onto the shared handler registry.
- Remove duplicated materialization logic where parity is confirmed.

## Acceptance Criteria
- Scene previews no longer depend on client-side completion attachment.
- Studio Session migration has a verified parity plan or completed handler migration.
- Shared infrastructure meaningfully reduces duplicate materialization logic.
