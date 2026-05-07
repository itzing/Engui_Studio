---
id: ENGUI-242
title: Add studio portfolio list create and update APIs
status: Done
assignee: []
created_date: '2026-05-07 17:49'
labels: [studio, portfolio, refactor]
dependencies: [ENGUI-238, ENGUI-240]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement /api/studio/portfolios endpoints for list, create, get, and patch/archive. Creation should validate workspace and Character Manager character, default the portfolio name from the character, and return portfolio summaries with character preview data.

Reference docs:

- `docs/studio-portfolio-refactor-plan.md`
- `docs/studio-portfolio-technical-spec.md`
<!-- SECTION:DESCRIPTION:END -->
