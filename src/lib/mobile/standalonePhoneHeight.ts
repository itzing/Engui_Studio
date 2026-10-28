/**
 * iOS standalone can leave 100dvh one status-bar height short after keyboard dismissal.
 * Use the physical CSS screen size only on installed iPhones; never pan the document.
 */
export function installStandalonePhoneHeight(): () => void {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone
    || window.matchMedia('(display-mode: standalone)').matches;
  if (!standalone || !/iPhone|iPod/.test(navigator.userAgent)) return () => {};

  const style = document.body.style;
  const property = '--engui-standalone-phone-height';
  const previous = style.getPropertyValue(property);
  const priority = style.getPropertyPriority(property);
  const update = () => {
    const { width, height } = window.screen;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    // Orientation must not come from the keyboard-reduced visual viewport.
    const angle = window.screen.orientation?.angle
      ?? (window as Window & { orientation?: number }).orientation;
    const landscape = typeof angle === 'number'
      ? Math.abs(angle % 180) === 90
      : window.matchMedia('(orientation: landscape)').matches;
    const pixels = landscape ? Math.min(width, height) : Math.max(width, height);
    const next = `${pixels}px`;
    if (style.getPropertyValue(property) !== next) style.setProperty(property, next);
  };

  update();
  window.addEventListener('resize', update, { passive: true });
  window.addEventListener('orientationchange', update);
  window.addEventListener('pageshow', update);
  window.screen.orientation?.addEventListener('change', update);
  return () => {
    window.removeEventListener('resize', update);
    window.removeEventListener('orientationchange', update);
    window.removeEventListener('pageshow', update);
    window.screen.orientation?.removeEventListener('change', update);
    if (previous) style.setProperty(property, previous, priority);
    else style.removeProperty(property);
  };
}
