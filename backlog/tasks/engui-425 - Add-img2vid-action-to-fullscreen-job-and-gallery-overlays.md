# ENGUI-425 - Add img2vid action to fullscreen job and gallery overlays

status: done
labels: [desktop, mobile, jobs, gallery, img2vid]

## Goal

Add an `img2vid` action icon while viewing images in fullscreen Jobs/Gallery overlays.

## Scope

- Mobile Jobs fullscreen viewer.
- Mobile Gallery fullscreen viewer.
- Desktop Gallery fullscreen overlay viewer.
- Reuse existing job/gallery `img2vid` APIs and Create draft persistence.
- Do not add a duplicate desktop center Job panel action, because it already exists.

## Validation

- Focused tests for the shared reuse helper.
- Targeted ESLint on touched files.
- Production build, service restart, and route smoke checks.

## Rollback

Revert the implementation commit, run production build, restart `engui-studio.service`, and verify fullscreen overlays return to their previous action sets.

## Result

Implemented. Image items in fullscreen Jobs/Gallery viewers now expose a `Clapperboard` icon action that prepares an `img2vid` Create draft through the existing reuse endpoints. Mobile Jobs/Gallery closes the fullscreen viewer and routes to `/m/create`; desktop Gallery overlay closes after successful reuse and switches the Create workflow through the existing mode event. The desktop center Job panel was not changed.
