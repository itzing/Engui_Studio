---
id: ENGUI-68
title: Build Vibe Manager data model and CRUD API
status: Todo
assignee: []
created_date: '2026-04-13 19:27'
updated_date: '2026-04-13 19:27'
labels:
  - engui
  - vibe-manager
  - backend
  - data-model
dependencies: []
priority: high
---

## Description

Implement the persisted Vibe Manager data model and the first CRUD API layer for the MVP.

Requirements:
- add the `VibePreset` persistence model with fields: `name`, `baseDescription`, `tags`, `compatibleSceneTypes`, `status`, `createdAt`, `updatedAt`
- keep persisted status limited to `active` and `trash`
- allow duplicate names
- store tags and compatible scene types in normalized lowercase form
- provide CRUD API endpoints for create, read/list, update, soft delete, and restore
- make trash mode read-only at the API contract level except for restore
- keep permanent delete out of MVP
- document any storage decisions needed for tags and compatible scene types
