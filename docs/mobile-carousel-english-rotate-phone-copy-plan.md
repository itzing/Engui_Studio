# Mobile carousel English rotate-phone copy

## Goal

Keep the mobile Gallery Carousel orientation gate aligned with the product-wide English UI copy rule.

## Scope

- Replace the mobile `/m/carousel` rotate-phone gate copy with English text.
- Update focused component tests that assert the gate copy.
- Do not change carousel orientation behavior.

## Validation

- Focused mobile carousel component test.
- Targeted ESLint on touched source/test files.
- Production build, service restart, and route smoke checks after commit.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the previous rotate-phone copy returns.
