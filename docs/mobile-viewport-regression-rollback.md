# Mobile viewport regression rollback

## Incident

On 2026-10-28 the owner reported that the mobile application no longer opened after viewport fix 0f445de. HTTP routes still returned 200. The owner screenshot confirms the Next.js "Application error: a client-side exception has occurred" screen in the installed iPhone app. It does not include a stack trace, so the exact failure mechanism is unconfirmed. Chromium viewport mocks are insufficient to validate native iPhone behavior.

## Recovery

1. Revert 0f445de runtime/test changes to the exact 7e96ba5 source baseline.
2. Retain the ENGUI-565 record, marked reverted, and preserve RunPod connection health and gallery bookmark features.
3. Run existing mobile/form-factor/gallery/RunPod regression tests and build production.
4. Restart engui-studio.service and verify HTTP plus client navigation using read-only fixtures.
5. Commit/push as the owner. Request native-device confirmation without claiming it was tested remotely.

No new keyboard workaround is included. The original keyboard dismissal gap may return. Any future correction must avoid synthetic-only evidence and needs real-device validation.

## Reversibility

The failed change remains in git history. Do not reapply it without a verified replacement. No database, jobs, credentials, or endpoint configuration changes are required.

## Deployment result

Runtime and test source exactly matches 7e96ba5; only incident documentation differs. Production build and 39 regression tests passed. The service was restarted at 22:31:53 UTC. All 10 HTTP probes and 13 fixture-backed Chromium checks against the owner-facing HTTPS site passed. The deployed shell no longer fixes the document body or installs the visualViewport controller.

This confirms rollback delivery and client rendering in Chromium, not native iPhone recovery or a fix for the original keyboard gap. The exact original client exception remains unconfirmed without a device stack trace. No RunPod jobs or production API writes were submitted by validation.
