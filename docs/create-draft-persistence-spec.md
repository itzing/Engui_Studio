# Create Draft Persistence Spec

## Goal
Persist the full Create state across reloads, including:
- active top-level workflow (`image`, `video`, `tts`, `music`)
- active `Using` model inside each workflow
- separate draft state per model id
- restore compatibility with `reuse` flows

## Scope
Mobile and desktop Create only.
No server persistence, local browser storage only.

## Required behavior

### 1. Top-level workflow persistence
The Create panel must restore the last active workflow:
- `image`
- `video`
- `tts`
- `music`

### 2. `Using` persistence
Each workflow must restore the last selected model inside its own `Using` dropdown.
Examples:
- image -> `z-image`
- video -> `wan22`
- tts -> `elevenlabs-tts`
- music -> `elevenlabs-music`

### 3. Per-model draft isolation
Drafts must be stored separately per model id, not as one shared draft per workflow.
Examples:
- `image.drafts["z-image"]`
- `image.drafts["flux-krea"]`
- `video.drafts["wan22"]`

Switching `Using` must not overwrite another model's fields.

### 4. Persistence triggers
Draft data must persist when:
- user edits any form field
- user changes `Using`
- user applies `reuse`

Implementation detail: persistence may be effect-driven, but behavior must match the rules above.

### 5. Restore order
On load:
1. restore top-level workflow
2. restore active `Using` model for that workflow
3. restore draft for that exact model id
4. only apply model defaults for fields missing from draft

Model defaults must never overwrite an existing restored draft.

### 6. Reuse behavior
When `reuse` is triggered:
- switch to the correct top-level workflow
- switch to the correct `Using` model
- write the reused payload into that model's draft
- render the form from the updated draft

After reload, the reused state must still be present.

### 7. Media persistence
Where practical, persist media preview/input references with the draft.
If a source can be restored from a stored path or data URL, restore it.
If a source cannot be safely restored, preserve all other draft fields and fail gracefully.

## Suggested storage shape

```json
{
  "version": 1,
  "activeMode": "image",
  "workflows": {
    "image": {
      "activeModel": "z-image",
      "drafts": {
        "z-image": {},
        "flux-krea": {}
      }
    },
    "video": {
      "activeModel": "wan22",
      "drafts": {
        "wan22": {}
      }
    },
    "tts": {
      "activeModel": "elevenlabs-tts",
      "drafts": {
        "elevenlabs-tts": {}
      }
    },
    "music": {
      "activeModel": "elevenlabs-music",
      "drafts": {
        "elevenlabs-music": {}
      }
    }
  }
}
```

## Non-goals
- no server sync
- no cross-browser sync
- no migration of obsolete temporary UI-only state unless needed for restore correctness
