---
id: engui-145
title: Run iPhone PWA QA and desktop regression pass
status: open
priority: high
labels: [mobile, pwa, qa, desktop]
created_at: 2026-04-20
updated_at: 2026-04-20
assignee: openclaw
---

## Summary

Run a focused QA pass on the new route-based mobile PWA, plus a desktop regression pass to verify the milestone did not degrade the current desktop experience.

## Desired outcome

The mobile route tree is validated on iPhone PWA and desktop parity is explicitly confirmed before the PWA entry point is switched.

## Acceptance criteria

- [ ] iPhone PWA keyboard and focus flows are tested
- [ ] Safe-area and orientation behavior are tested
- [ ] Mobile route navigation is tested end-to-end
- [ ] Draft persistence is tested across mobile routes
- [ ] Desktop regression pass confirms no intentional UX change
- [ ] Follow-up bugs are either fixed or captured as separate tickets
