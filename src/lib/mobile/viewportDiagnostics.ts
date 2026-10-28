// Temporary ENGUI-568 capture; both client and server stop at this deadline.
export const VIEWPORT_DIAGNOSTICS_UNTIL = 1793231405131;
export const viewportMetricKeys = [
  'seq', 'elapsed', 'standalone', 'iosMajor', 'iosMinor', 'focused', 'dpr',
  'screenWidth', 'screenHeight', 'availableHeight', 'innerWidth', 'innerHeight', 'outerHeight',
  'visualHeight', 'visualWidth', 'visualTop', 'visualPageTop', 'visualScale',
  'scrollX', 'scrollY', 'rootClientHeight', 'rootScrollHeight', 'rootScrollTop',
  'rootMinHeight', 'bodyTop', 'bodyBottom', 'bodyHeight', 'bodyScrollTop',
  'shellTop', 'shellBottom', 'shellHeight', 'navTop', 'navBottom', 'navHeight',
  'navPaddingBottom', 'navGridBottom',
] as const;
const events = ['mount', 'focusin', 'focusout', 'resize', 'scroll', 'settle', 'pageshow'];
const screens = ['create', 'prompt', 'jobs', 'gallery', 'carousel', 'other'];

export function sanitizeViewportSample(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;
  if (typeof data.page !== 'string' || !/^[a-z0-9-]{1,24}$/.test(data.page)) return null;
  if (typeof data.event !== 'string' || !events.includes(data.event)) return null;
  if (typeof data.screen !== 'string' || !screens.includes(data.screen)) return null;
  const metrics: Record<string, number> = {};
  if (data.metrics && typeof data.metrics === 'object') {
    const source = data.metrics as Record<string, unknown>;
    for (const key of viewportMetricKeys) {
      const value = source[key];
      if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10_000_000) {
        metrics[key] = Math.round(value * 100) / 100;
      }
    }
  }
  if (!Object.keys(metrics).length) return null;
  return { page: data.page, event: data.event, screen: data.screen, metrics };
}
