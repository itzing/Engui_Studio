---
id: ENGUI-318
title: Add desktop prompt editor modal for Create Image
status: Done
assignee: openclaw
created_date: 2026-05-10
updated_date: 2026-05-10
labels: [desktop, create-image, ux]
---

## Summary

Make the desktop Create Image prompt easier to edit by opening a larger modal editor when the prompt field receives focus.

## Requirements

- Desktop Create Image only; do not change the mobile prompt flow.
- Focusing the existing prompt textarea opens a larger modal with a large textarea.
- Ctrl+Enter in the modal saves the modal text, closes the modal, and updates the existing prompt field.
- Provide visible Save and Cancel actions for mouse users.
- Respect locked prompt states such as selected Prompt Constructor drafts.

## Validation

- Component test for focus -> modal -> Ctrl+Enter save behavior.
- Production build before deploy.
