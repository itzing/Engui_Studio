# ENGUI-558 - Repair Studio launch with shared Default LoRAs

Status: In Progress
Created: 2026-10-13
Labels: [studio, workspaces, lora, bug]

## Problem
A Showdown Studio run using a shared Default LoRA fails before job creation. The source-use activity is created under the consumer workspace context even though it belongs to the LoRA owner. The workspace guard correctly rejects the cross-workspace write. The uncaught API failure produces a non-JSON response and Studio masks it with Unexpected end of JSON input.

## Plan
- Keep shared-LoRA access validation and strict content ownership guards intact.
- Write and maintain only the validated source-use activity tokens in their owning workspace context; retain the consumer context for actual job submission.
- Return structured generation errors and safely handle non-JSON upstream responses in Studio.
- Regression-check shared/own/private LoRA access, lease cleanup and renewal, consumer job ownership, and actionable empty response handling without live provider jobs.
- Build, commit/push with the user identity, deploy, and verify service health. No schema or content migration.

## Acceptance Criteria
- [x] Shared Default LoRA submission does not trigger cross-workspace ownership rejection.
- [x] Source deletion protection and consumer isolation remain intact.
- [x] Studio displays actionable errors instead of JSON parser failures.
- [ ] Offline regression checks and production build pass; no paid generation is launched.

## Validation
18 checks pass across the shared-LoRA launch integration, wardrobe and character preview suites. The integration uses a copied SQLite database, real workspace guards and the actual Studio launch and generation routes; all provider calls are mocked. It verifies source lease creation/renewal/cleanup, consumer-owned jobs, distinct auto-selected poses, forbidden private access and actionable empty-response errors. Live generation was not invoked.
