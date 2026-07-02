# ENGUI-331 - Show WAN22 steps on desktop

Status: done

## Goal

Make the WAN 2.2 generation `steps` control visible on the desktop create form while keeping the mobile create surface unchanged.

## Scope

- Desktop Video -> Wan 2.2 advanced settings should expose the existing `steps` parameter.
- Mobile `/m/create` should continue to hide the parameter.
- Keep the current default value and submission contract unchanged.

## Validation

- `npm run build`
- Restart `engui-studio.service` after deployment.

## Rollback

- Revert the `VideoGenerationForm` visibility change and rebuild/restart the service.
