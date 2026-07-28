# Carousel Spread Shuffle Plan

## Goal

Reduce cases where Carousel shuffle shows images that are adjacent or near-adjacent in the Gallery source order.

## Approach

1. Keep `/api/carousel/feed-window` as the shuffle authority for desktop and mobile.
2. Preserve the existing deterministic seed contract.
3. Add a spread shuffle mode in the shared feed helper:
   - sort candidates by gallery/source order;
   - split the ordered set into source-order bands;
   - shuffle within each band with the seeded random function;
   - interleave bands in seeded order;
   - run a repair pass to swap away adjacent items that remain too close in source order.
4. Apply the same source-distance guard when grouping images into multi-image slots.
5. Add focused regression tests for source-order spread, image-slot distance, and stable API windows.

## Validation

- Focused helper tests for spread shuffle.
- Focused API route tests for deterministic windows.
- Targeted lint and production build before deployment.
