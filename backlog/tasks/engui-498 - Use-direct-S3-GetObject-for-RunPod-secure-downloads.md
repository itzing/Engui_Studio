---
id: ENGUI-498
title: Use direct S3 GetObject for RunPod secure downloads
status: Done
assignee: []
created_date: '2026-08-07 19:00'
updated_date: '2026-08-07 19:23'
labels:
  - backend
  - infra
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
RunPod S3 currently returns 403 for HeadObject on secure-jobs result objects while direct GetObject succeeds. Engui finalization uses aws s3 cp, which performs HeadObject preflight and leaves completed jobs stuck in finalizing until RunPod status expires.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Secure result downloads use direct GetObject and do not require HeadObject.
- [x] #2 Existing non-secure S3 downloads continue to work.
- [x] #3 Focused tests cover the AWS CLI command shape.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Update S3Service.downloadFile to call aws s3api get-object into a temp file; add/adjust focused tests; run production build and restart engui-studio.service.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented direct aws s3api get-object downloads in S3Service.downloadFile to avoid RunPod HeadObject 403 on secure-jobs objects. Added supervisor recovery for completed secure transport results when RunPod no longer returns job status, plus tests. Deployed and recovered current z-image jobs to completed.
<!-- SECTION:FINAL_SUMMARY:END -->
