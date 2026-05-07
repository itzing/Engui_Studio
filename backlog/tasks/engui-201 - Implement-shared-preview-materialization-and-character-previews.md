# engui-201 - Implement shared preview materialization and character previews

## Summary
Implement a durable backend-owned preview generation and materialization flow for Character Manager, using a shared materialization architecture that can later be adopted by scene previews and Studio Sessions.

## Specification
- `backlog/specs/shared-preview-materialization-and-character-previews.md`

## Goals
- Make Character Manager preview cards functional.
- Persist generated preview images on the character.
- Expose a portrait thumbnail to downstream character selectors.
- Establish a shared materialization framework instead of relying on client-owned preview attachment.

## Child tasks
- ENGUI-201.1
- ENGUI-201.2
- ENGUI-201.3
- ENGUI-201.4
- ENGUI-201.5
- ENGUI-201.6

## Acceptance Criteria
- Character previews are durable and reload-safe.
- Shared preview materialization infrastructure exists and is reusable.
- Character portrait thumbnails can be shown across the product.
