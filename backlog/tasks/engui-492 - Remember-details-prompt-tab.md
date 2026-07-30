# engui-492 - Remember details prompt tab

## Status

Done

## Context

Job Details and Gallery Details reset the prompt tab to `Original`/`Video` whenever the selected job or gallery asset changes. When comparing video prompt metadata across items, the last selected prompt view should carry over to the next item.

## Acceptance Criteria

- [x] Desktop Job Details opens the next navigated job on the last selected prompt tab when available.
- [x] Mobile Job Details uses the same persisted prompt tab preference.
- [x] Desktop Gallery Details opens the next selected asset on the last selected prompt tab when available.
- [x] Mobile Gallery Details uses the same persisted prompt tab preference.
- [x] If the saved tab is unavailable for the next item, the details view falls back to the first available prompt tab.
- [x] Tests cover persistence and fallback behavior.
- [x] Production build and service restart complete.

## Rollback

Revert the implementation commit, run `npm run build`, and restart `engui-studio.service`.
