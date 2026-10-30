# Mobile Create prompt-card paste

## Scope and interaction

Mobile image Create only. Put a 44x44 Paste icon on the right side of the existing Prompt preview card. The text area remains a link to the prompt editor; the icon is a sibling button, never nested in the link. Paste reads the clipboard on the tap gesture and immediately replaces the image-create prompt without navigation, autofocus, helper changes or generation.

Use the same clipboard hook in Create and the editor for exact text preservation, empty/error handling, request deduplication and cancellation. Preserve editor Save/Cancel semantics. Cancel a pending read when leaving, changing workspace/model/draft context or unmounting; ignore stale results. A selected constructor draft hides the entire manual prompt card as before. Home error guidance directs the user to the editor for manual paste.

## Validation and rollback

Test immediate replacement, empty prompt, exact whitespace/newlines, empty/denied/unavailable clipboard, duplicate clicks, late result cancellation and draft mode. Browser fixtures verify 320/390px hit target/layout, no link activation or generation, preview/editor persistence and existing editor Save/Cancel. Run isolated production build with ENGUI_ISOLATED_VALIDATION=1, preserve the serving build, and retain previous.next for rollback. No paid jobs or real clipboard contents are used in validation.

## Verification

73 targeted tests pass, including the original editor paste tests and new home cancellation/error cases. Production build passes. WebKit and Chromium each pass 34 preview/production scenarios. 320/390px screenshots show the icon on the right of the card; 390px screenshot visually inspected. Exact text reaches the editor, home paste never navigates or opens the keyboard, and late home reads cannot overwrite the editor. Deployed 2026-10-30 12:01:37 UTC. Fixtures use synthetic clipboard contents and block production API writes; physical iOS clipboard permission UI is not emulated.
