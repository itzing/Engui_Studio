export type MobileViewportFormFactor =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape';

export type ViewportFormFactorInput = {
  width: number;
  height: number;
  touch: boolean;
};

const MIN_TABLET_SHORT_SIDE = 600;
const MIN_TABLET_LONG_SIDE = 900;
const MAX_TABLET_ASPECT_RATIO = 1.8;

export function getViewportFormFactor({
  width,
  height,
  touch,
}: ViewportFormFactorInput): MobileViewportFormFactor {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const isLandscape = safeWidth > safeHeight;
  const shortSide = Math.min(safeWidth, safeHeight);
  const longSide = Math.max(safeWidth, safeHeight);
  const aspectRatio = shortSide > 0 ? longSide / shortSide : Number.POSITIVE_INFINITY;
  const isTabletSized = touch
    && shortSide >= MIN_TABLET_SHORT_SIDE
    && longSide >= MIN_TABLET_LONG_SIDE
    && aspectRatio <= MAX_TABLET_ASPECT_RATIO;

  if (isTabletSized) {
    return isLandscape ? 'tablet-landscape' : 'tablet-portrait';
  }

  return isLandscape ? 'phone-landscape' : 'phone-portrait';
}
