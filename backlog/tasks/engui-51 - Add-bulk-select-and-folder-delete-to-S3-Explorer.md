---
id: ENGUI-51
title: Add bulk select and folder delete to S3 Explorer
status: In Progress
assignee: []
created_date: '2026-04-12 15:03'
updated_date: '2026-04-12 15:03'
labels:
  - engui
  - s3-explorer
  - ux
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Improve the S3 Explorer UX with two operations for the currently opened folder:

- Select all visible items in the current folder.
- Delete an entire folder together with all nested contents.

Requirements:
- Keep the selection behavior scoped to the open folder view.
- Folder deletion must remove nested files/subfolders, not only an empty marker.
- Preserve existing confirmation/safety affordances where appropriate.
- Build, deploy, commit, and push after implementation.
<!-- SECTION:DESCRIPTION:END -->
