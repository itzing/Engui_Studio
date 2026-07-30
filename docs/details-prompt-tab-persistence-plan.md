# Details Prompt Tab Persistence Plan

## Problem

Prompt tabs in Job Details and Gallery Details reset to `Original` or `Video` every time the user navigates between jobs/assets. This makes it tedious to compare `Resolved video`, `Source image`, or `Resolved source` across multiple items.

## Plan

1. Add a small shared prompt tab preference helper backed by `localStorage`.
2. Use it in desktop and mobile Job Details and Gallery Details.
3. Validate the saved tab against each item's available prompt tabs, falling back to the first available mode when needed.
4. Add focused regression tests for persistence and fallback.
5. Run focused tests, lint, Prisma validation, production build, service restart, smoke checks, commit, and push.

## Rollback

Revert the new Engui commit, rebuild, and restart `engui-studio.service`.
