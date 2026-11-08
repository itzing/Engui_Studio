# Mobile TikTok Info action

## Scope

Mobile only. Add Info to the existing tap-revealed TikTok action overlay. Reuse `/m/gallery/[id]`, the same details screen opened by Info in the mobile Gallery; do not duplicate metadata rendering or add a new API.

## Implementation

Expose an optional asset-info callback on the shared carousel. Only the mobile wrapper supplies it, and only when TikTok mode is selected. Resolve the asset from the existing centered action slot. Place the Info icon inside the existing propagation-blocking action container. Navigate using the mobile wrapper router.

## Validation and deployment

Run existing carousel and gallery-details tests. Check real mobile rendering with synthetic feed/detail responses in WebKit and Chromium: hidden/shown controls, current asset, swipe to another asset, correct existing details view, no new button in desktop/ordinary carousel. Do not submit generation jobs. Build separately from the serving `.next`, keep the prior build for rollback, deploy and verify the live service.

## Delivered behavior and checks

The 48 px Info action appears only in the mobile TikTok overlay after revealing controls. It opens the existing Gallery details route for the centered video, including after a swipe. Existing details-screen navigation is preserved. Desktop does not supply the optional callback, and ordinary carousel mode does not display the action.

- 52 existing tests passed across carousel, mobile carousel, gallery-details sharing and mobile-details navigation.
- Production build completed in isolated staging without replacing the live build during compilation.
- WebKit and Chromium each passed 11 browser checks in preview and again after deployment, with 390 px and 320 px viewports and fully intercepted synthetic API data. No write requests or generation jobs occurred.
- Production service was restarted and page probes returned HTTP 200. The previous `.next` is retained at `/home/engui/engui-runs/engui-577-20261108/previous.next` for rollback.
- Validation does not claim a new global TypeScript-clean baseline or a physical-device test.
