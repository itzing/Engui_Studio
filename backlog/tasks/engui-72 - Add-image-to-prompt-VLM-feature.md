---
id: ENGUI-72
title: Add image-to-prompt VLM feature
status: Todo
assignee: []
created_date: '2026-04-14 11:56'
updated_date: '2026-04-14 11:56'
labels:
  - engui
  - llm
  - vlm
  - prompt-helper
  - image-to-prompt
dependencies: []
priority: medium
---

## Description

Add a separate image-to-prompt feature that uses a dedicated local multimodal model to analyze an input image and generate a reusable generation prompt.

Requirements:
- keep the current Gemma text-only prompt helper unchanged
- implement the new feature as a separate path, model, and endpoint dedicated to `image -> prompt`
- choose a VLM that fits the current machine well, with `Qwen2.5-VL-3B-Instruct-GGUF` as the recommended starting point
- keep open the option to later switch to a stronger uncensored caption-focused model if the first version is too weak for detailed or NSFW prompt extraction
- run the new VLM as a separate local inference service so it does not interfere with the existing prompt-helper model
- expose a simple API contract that accepts an image and returns a cleaned prompt-oriented text result
- optimize the prompt template for prompt extraction, not generic image Q&A
- make the result suitable for reuse in generation flows, with emphasis on subject, composition, style, lighting, camera framing, mood, environment, and other prompt-relevant details
- design the feature so it can later support both safe general captioning and more relaxed uncensored extraction modes if needed
- keep the first implementation focused on single-image input only
- document model choice, runtime constraints, and replacement path for later upgrades

Implementation notes:
- recommended first model: `Qwen2.5-VL-3B-Instruct-GGUF`
- fallback / upgrade candidate for stronger uncensored captioning: `bartowski/thesby_Qwen2.5-VL-7B-NSFW-Caption-V3-GGUF`
- MiniCPM-V remains a lightweight alternative, but is not the first recommendation for prompt-quality extraction on this machine
