---
id: ENGUI-260
title: Add legacy template to portfolio migration adapter
status: Cancelled
assignee: []
created_date: '2026-05-07 17:49'
labels: [studio, portfolio, refactor]
dependencies: [ENGUI-238, ENGUI-239, ENGUI-241]
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement helper functions to map a StudioSessionTemplate into a portfolio/session and one run draft per non-zero category rule. Do not auto-migrate by default; expose this as a server-side adapter with tests.

Reference docs:

- `docs/studio-portfolio-refactor-plan.md`
- `docs/studio-portfolio-technical-spec.md`
<!-- SECTION:DESCRIPTION:END -->

## Cancellation note

No longer planned: Studio is a v1 rewrite/product refactor with no legacy template migration/backward compatibility requirement.
