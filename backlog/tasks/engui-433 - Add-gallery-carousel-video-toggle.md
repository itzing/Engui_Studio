# ENGUI-433 - Add Gallery Carousel video toggle

status: done
labels: [desktop, mobile, gallery, carousel, filters]

## Goal

Add a `Videos` checkbox alongside `Images` in Gallery Carousel settings, with at least one media type always enabled.

## Scope

- Desktop fullscreen `GalleryVideoCarousel` controls.
- Mobile `/m/carousel` settings.
- Shared carousel feed construction for videos-only, videos+images, and images-only modes.
- Keep default behavior as videos enabled and images disabled.
- Keep orientation filters independent, and do not allow disabling both `Landscape` and `Portrait`.

## Validation

- Focused carousel helper and component tests.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Result

Added `Videos` and `Images` media-type toggles to desktop and mobile Gallery Carousel settings. Videos stay enabled by default, Images stay disabled by default, and the UI prevents turning off the last enabled media type. The shared feed builder now supports videos-only, videos+images, and images-only playback.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify carousel settings return to Images-only optional toggle.
