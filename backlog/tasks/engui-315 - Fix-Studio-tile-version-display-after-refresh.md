# ENGUI-315 - Fix Studio tile version display after refresh

Status: done

## Request
After browser refresh, Studio run tiles visually show version 1/4 even though the real/default current position is the latest version 4/4. Version arrows then navigate from the real latest position, proving the display resolver is inconsistent.

## Scope
- Use one version resolver for tile display, review buttons, gallery, and navigation default.
- Default to the latest non-hidden version after refresh unless the user explicitly chooses another version in local UI state.
- Make Launch run filtering evaluate the latest non-hidden version review state, not a stale selected version.

## Rollback
Revert the implementation commit, rebuild, and restart `engui-studio.service`.
