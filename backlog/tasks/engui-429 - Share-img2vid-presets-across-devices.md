# ENGUI-429 - Share img2vid presets across devices

status: done
labels: [desktop, mobile, create, img2vid, presets, bug]

## Goal

Make Create video/img2vid presets created on mobile visible on desktop, and vice versa.

## Scope

- Shared desktop/mobile `VideoGenerationForm`.
- Move img2vid presets from browser-only storage to server-backed workspace storage.
- Migrate existing browser-local presets into server storage from the same device after deploy.
- Keep preset naming, apply, selected draft persistence, and inline-confirm delete behavior.

## Validation

- Focused preset storage/API tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify the form returns to local-only preset behavior.
