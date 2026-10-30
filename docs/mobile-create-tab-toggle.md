# Mobile Create tab reselect

## Scope and behavior

Only the phone bottom navigation changes. On the exact /m/create route, an unmodified activation of the active Create tab toggles image to video and video to image. From audio or music, reselect enters image. Other tabs and nested Create routes continue navigating to the Create root without changing the remembered mode. Modified link clicks keep native link behavior.

Pass an optional reselect callback from MobileCreatePage through MobileAppShell into MobileBottomNav. Reuse the page's existing mode-change handler and persisted create draft store; do not add global events, a second mode store or navigation remounts. Preserve the label, active styling, top mode controls, independent workflow drafts, tablet/desktop layouts and standalone iPhone height fix.

## Validation and rollback

Unit coverage verifies actual page-shell-nav wiring, both toggle directions, existing mode controls, persisted initial mode, audio fallback and ordinary/modified/nested navigation. Browser checks exercise real image/video forms and retained prompt/settings, navigation away and back, nested editor return and reload. No jobs or real API writes. Build isolated with ENGUI_ISOLATED_VALIDATION=1 and preserve the serving .next until checks pass. Retain previous.next for rollback and revert the feature commit if needed.

## Verification

88 focused tests and isolated production build pass. WebKit and Chromium each passed 42 scenarios in preview and deployed HTTPS, including root reselect, nested editor return, separate image/video prompt and settings persistence, reload and returning from Jobs/Gallery/Carousel without toggling. Zero page errors, unexpected API paths or production writes/jobs. Service restarted 2026-10-30 12:15:28 UTC. Previous build retained at /home/engui/engui-runs/engui-574-20261030/previous.next. Desktop/tablet and the standalone iPhone height fix remain unchanged. Physical iPhone interaction awaits owner confirmation.
