# ENGUI-390 - Strengthen WAN22 I2V helper system prompt

## Status

Done

## Context

The current `wan22-video` Prompt Helper system prompt captures the high-level I2V idea, but it is a compressed MVP summary of the WAN 2.2 image-to-video prompting guide. It should better encode the guide's core behavior so rough user intent is enriched into a strong WAN 2.2 I2V prompt.

## Scope

- Runtime `wan22-video` Prompt Helper system prompt.
- Focused provider-level test coverage for the new system prompt rules.
- No `wan22-t2v` behavior changes.

## Acceptance Criteria

- [x] The `wan22-video` system prompt explicitly treats the source image as carrying identity, appearance, framing, background, and scene context.
- [x] The prompt prioritizes motion, one clear action beat, micro-motion, one simple camera move, initial-pose anchoring, and natural realism.
- [x] The prompt preserves narrow-edit behavior while allowing richer improvement for vague or broad instructions.
- [x] The provider request sends the strengthened system prompt for `helperProfile: "wan22-video"`.

## Implementation Notes

- Replaced the compressed inline `wan22-video` system prompt with a dedicated `WAN22_VIDEO_SYSTEM_PROMPT` constant grounded in the WAN 2.2 I2V prompting guide.
- Added explicit rules for source-image grounding, motion-first prompting, one action beat, micro-motion, one simple camera move, source-pose anchoring, and concise director-style English output.
- Added provider-level coverage that verifies the strengthened system prompt is sent for `helperProfile: "wan22-video"`.

## Rollback

Revert the implementation commit, rebuild, and restart `engui-studio.service`.
