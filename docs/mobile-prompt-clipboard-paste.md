# Mobile prompt clipboard paste (ENGUI-569)

## Scope and UI

Mobile Create / Prompt manual editing only. Add a ClipboardPaste icon to the right of the Prompt label, grouped with the existing Clear action. Use a 44px touch target, English accessible name/title "Paste and replace prompt", and a busy indicator while reading. Prompt Constructor draft mode continues to hide manual editing. Desktop and viewport sizing remain unchanged.

## Behavior

Call navigator.clipboard.readText directly from the button click to preserve Safari user activation. Replace the entire controlled prompt, preserving the exact nonempty clipboard text including newlines and spaces. Do not insert at a caret, auto-focus, navigate, save or run generation. Empty clipboard text and unsupported/denied reads keep the existing prompt and show a short English toast with manual-paste guidance. Do not log clipboard contents.

Keep current Save/Cancel semantics. Invalidate an in-flight clipboard request on navigation and unmount so a late read cannot overwrite a canceled or abandoned prompt. Prevent duplicate requests while busy. No separate confirmation, modal or fallback control is needed.

## Validation and deployment

Check replacement from nonempty text, empty prompt, denied/unsupported/empty clipboard, exact multiline text, Save/Cancel and a late result after Cancel/unmount. Browser checks use synthetic clipboard values and fixture APIs in WebKit and Chromium; no production generation calls. The native iOS clipboard permission UI is not reproducible on a Linux browser.

Build in isolation with ENGUI_ISOLATED_VALIDATION=1 so production remains intact. Preserve previous.next for rollback, swap the finished build, restart engui-studio.service and verify the deployed route. Commit and push under the owner's identity. Rollback restores the prior build and reverts the commit when necessary.

## Implementation and validation

Implemented in MobilePromptScreen without changing desktop, shared textarea runtime or the confirmed standalonePhoneHeight correction. 34 targeted tests pass, including 10 new clipboard behavior cases. Updated the pre-existing wildcard test fixture to select a workspace and return a real Response compatible with workspaceFetch; no wildcard production behavior changed.

Isolated production build succeeds. WebKit and Chromium preview each pass 23 scenarios, including exact multiline replacement, untouched helper instruction, no forced textarea focus, empty/denied clipboard, Cancel rollback, Save persistence and 320px layout. Clipboard contents and permissions are synthetic browser fixtures; no claim of physical iOS clipboard UI testing. Existing iPhone height regression scenarios still pass.

Service restarted 2026-10-30 11:24:04 UTC. Prior build retained at /home/engui/engui-runs/engui-569-20261030/previous.next; public prompt route returns HTTP200. Browser reports: runs/engui-mobile-prompt-paste-20261030 in the agent workspace. No generation jobs started.

Deployed HTTPS verification also passes 23 scenarios per engine, zero page errors, unexpected API paths and production API writes. Preview shut down cleanly.
