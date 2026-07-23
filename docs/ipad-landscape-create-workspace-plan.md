# iPad Landscape Create Workspace Plan

## Problem

The existing `/m/*` UI is optimized for phones. On iPad landscape it stretches phone-oriented controls, makes Jobs sparse, and compresses Gallery assets vertically.

## Product Direction

Keep the phone experience intact and introduce one dedicated tablet landscape workspace inside `/m/create`.

The tablet route should feel like a touch-first production desk:

- Create controls stay on the left.
- The preview area stays on the right.
- Recent jobs sit in a bottom filmstrip.
- Gallery and Carousel are available as icon entry points from the workspace.

## Form Factors

- Phone portrait: existing mobile UI.
- Phone landscape: blocking panel with `Rotate your phone`.
- Tablet portrait: blocking panel with `Rotate to landscape`.
- Tablet landscape: new tablet workspace.

Detection should use viewport dimensions and touch capability:

- Tablet-sized viewport: shortest side at least 600px, longest side at least 900px, aspect ratio no wider than about 1.8.
- Tablet landscape: tablet-sized and width greater than height.
- Tablet portrait: tablet-sized and height greater than or equal to width.
- Phone landscape: non-tablet landscape.

## Tablet Create Layout

Top region:

- Left pane: Create controls. Image Create gets compact direct controls. Other Create modes can render their existing forms in the left pane first, then be refined later.
- Right pane: selected job output preview, actions, and Asset/Info toggle.

Bottom region:

- Horizontal Jobs strip.
- No visible paging.
- Swipe/scroll loads additional jobs as the user moves through the strip.
- Tiles show minimal information only.
- Completed image/video jobs show contained thumbnails on a black background.
- Videos get a play icon overlay.
- Pending jobs show the same image/video placeholder icon language as current mobile Jobs.
- The top edge is draggable to resize the strip between a compact minimum, a comfortable default, and one third of the viewport.

## Safety Constraints

- Do not change phone portrait visuals intentionally.
- Do not add tablet portrait layouts in this pass.
- Do not add phone landscape layouts in this pass.
- Do not change desktop UI.
- Keep business actions wired to existing APIs and draft persistence helpers.
