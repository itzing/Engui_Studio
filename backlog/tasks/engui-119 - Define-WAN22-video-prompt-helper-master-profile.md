---
id: ENGUI-119
title: Define WAN 2.2 video Prompt Helper master profile
status: Done
assignee: []
created_date: '2026-04-18 21:06'
updated_date: '2026-04-18 21:33'
labels:
  - prompt-helper
  - video
  - wan22
  - ai
dependencies: []
references:
  - /home/engui/Engui_Studio/specs/prompt-helper-mvp-spec.md
  - /home/engui/Engui_Studio/specs/wan22-video-prompt-helper-profile.md
  - /var/lib/openclaw/.openclaw/workspace/projects/wan2.2video/README.md
  - /var/lib/openclaw/.openclaw/workspace/projects/wan2.2video/sources.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Convert the supplied WAN 2.2 prompting documentation into an internal master profile for Engui Prompt Helper.

This task defines how the helper should translate free-form user intent into WAN 2.2-friendly video prompts, including generation-from-empty behavior, rewrite behavior, output constraints, and any WAN-specific prompt structure or guidance that should be applied consistently.

The result should be a clear internal source of truth that backend Prompt Helper logic can follow without adding a separate provider stack.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The supplied WAN 2.2 prompting doc is linked or referenced from the task/result
- [x] #2 The master profile defines both generate-from-empty and rewrite-existing-prompt behavior
- [x] #3 The profile explicitly states what the helper must and must not add when adapting prompts for WAN 2.2
- [x] #4 The profile is designed to work through the existing Prompt Helper provider path rather than a separate helper service
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Created `/home/engui/Engui_Studio/specs/wan22-video-prompt-helper-profile.md` as the canonical WAN 2.2 Prompt Helper master profile for Engui. The profile is grounded in the practical WAN 2.2 image-to-video guide under `workspace/projects/wan2.2video`, defines rewrite and generate-from-empty behavior, codifies motion-first WAN prompting doctrine, sets default negative-prompt strategy, and explicitly keeps WAN mode on the existing Prompt Helper provider path instead of creating a separate helper backend.
<!-- SECTION:FINAL_SUMMARY:END -->
