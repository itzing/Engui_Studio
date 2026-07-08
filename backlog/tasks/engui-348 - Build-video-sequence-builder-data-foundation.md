---
id: engui-348
title: Build video sequence builder data foundation
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

Implement the first real desktop Video Sequence Builder foundation after the `engui-347` spec and shell: persisted sequences, segments, templates, CRUD APIs, and an editable `/video-sequences` UI backed by stored data.

## Acceptance Criteria

- [x] Add Prisma models for video sequences, sequence segments, and segment templates.
- [x] Add sequence/template/segment CRUD APIs without launching live generation jobs.
- [x] Replace the static `/video-sequences` shell with a desktop-only editable MVP backed by API data.
- [x] Support creating a sequence, adding/updating/deleting segments, inserting templates, and saving a segment as a template.
- [x] Add focused API/domain tests.
- [x] Production build passes.

## Notes

- Scope is desktop only.
- This task does not submit RunPod generation jobs or run live validation jobs.
- Rollback: revert the implementation commit, restore the pre-db-push SQLite backup if needed, rebuild, and restart `engui-studio.service`.
