---
id: engui-347
title: Specify desktop video sequence builder
status: Done
assignee: Rocky
created: 2026-07-08
---

## Summary

Write a detailed implementation specification for a desktop Video Sequence Builder and add the first navigation entry point to its dedicated page from the main desktop workspace.

## Acceptance Criteria

- [x] Add a detailed implementation spec under `docs/`.
- [x] Add a dedicated desktop Video Sequences page shell.
- [x] Add a desktop Workspace button immediately to the left of the Gallery button.
- [x] Production build passes.

## Notes

- Scope is desktop only.
- This task does not implement the full sequence generation backend.
- Rollback: revert the implementation commit, rebuild, and restart `engui-studio.service`.
