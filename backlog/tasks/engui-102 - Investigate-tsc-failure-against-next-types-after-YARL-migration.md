---
id: ENGUI-102
title: Investigate tsc failure against .next/types after YARL migration
status: Done
assignee: []
created_date: '2026-05-01 20:03'
labels: []
dependencies:
  - ENGUI-101
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Investigate the observed `npx tsc --noEmit` failure referencing missing `.next/types/**/*.ts` files after the YARL viewer migration. Determine whether this is a real tsconfig/configuration issue or a transient race caused by invoking typecheck while Next build artifacts are being regenerated. Result: the earlier missing-file error was transient, but a clean sequential run shows the repo still has substantial pre-existing type debt unrelated to the YARL migration. Apply only minimal viewer-related fixes introduced during the migration and leave broader repo-wide type cleanup for a separate effort.
<!-- SECTION:DESCRIPTION:END -->
