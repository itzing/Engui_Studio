# Desktop Character Manager overview release

Feature commit: `94fff5b`
Ticket: ENGUI-562
Surface: desktop only (1024 CSS px and above).

## Changes
- Two-column manager with a character library and wide Overview/Details workspace.
- Overview displays original-resolution Portrait, Upper body and Full body images in three equally sized cards. Images remain uncropped and adapt to the available window height.
- Preview settings opens beside the tabs; regeneration remains directly on each card. Timestamps are available on the generation-button tooltip.
- Details contains basics, traits, identity visibility, wardrobe, assistant editing and history. Both tab panels stay mounted; character/outfit edits and model/look choices survive tab switches.
- New opens Details; selecting a saved character opens Overview.
- Desktop fullscreen images use a nested accessible dialog with Previous/Next and Close. This avoids the previous body-portal viewer conflicting with the manager pointer/focus trap. The mobile viewer and stacked layout remain unchanged.

## Validation
- Targeted ESLint: 0 errors, 37 warnings (existing warnings plus the additional plain-image warning).
- `git diff --check`: passed.
- Local Chromium: main-page Character Manager at 1200x800 and Studio Character Manager at 1440x1000; all three original images loaded, use object-contain, and fit vertically. No horizontal overflow at 1024/1920 widths.
- Character age and unsaved wardrobe-description edits survive Overview/Details switches; generation is disabled while the character draft is dirty.
- Model and outfit selection survive tab switches; all three generation requests retain the correct slot, selected Krea2 model and neutral look. Requests were intercepted with offline responses, never submitted to the provider.
- Fullscreen navigation/close, keyboard tab navigation, New draft and empty preview states checked.
- Mobile 390x844: original stacked sections, compact cards, no Overview/Details tabs or horizontal overflow.
- Browser page errors and unexpected character/outfit writes: zero. During live QA, the existing StudioContext default-video-project POST was also intercepted and blocked; no project was created. All three preview POSTs received offline mock responses.
- QA artifacts: `/var/tmp/engui-character-overview/`. Isolated QA server stopped. Its no-op instrumentation stub is QA-only and is not in the feature commit.

## Deployment
Production build exited 0. Service restarted at 2026-10-13 11:20 UTC and remained active. HTTP checks for `/`, `/studio-sessions` and `/m/create` returned 200. The same browser workflow passed against the deployed service, including Escape closing only the fullscreen viewer. No backend/schema/data migration. No paid generation or character/outfit write was performed.

## Rollback
Revert `94fff5b`, rebuild, and restart `engui-studio.service`. Saved content and previews need no rollback.
