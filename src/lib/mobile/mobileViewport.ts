const ROOT_CLASS = 'engui-mobile-shell';
const HEIGHT_PROPERTY = '--engui-mobile-viewport-height';
const TOP_PROPERTY = '--engui-mobile-viewport-top';

function hasKeyboardFocus() {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return !element.readOnly && !element.disabled
      && ['text', 'search', 'email', 'url', 'tel', 'number', 'password'].includes(element.type);
  }
  return element.isContentEditable;
}

/** Own the mobile document viewport without changing nested screen scroll positions. */
export function installMobileViewport() {
  const root = document.documentElement;
  const body = document.body;
  const viewport = window.visualViewport;
  const rootHadClass = root.classList.contains(ROOT_CLASS);
  const bodyHadClass = body.classList.contains(ROOT_CLASS);
  const previousScroll = { x: window.scrollX, y: window.scrollY };
  const previousProperties = [HEIGHT_PROPERTY, TOP_PROPERTY].map(name => ({
    name,
    value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name),
  }));
  let frame: number | null = null;
  let timers: number[] = [];
  let disposed = false;

  root.classList.add(ROOT_CLASS);
  body.classList.add(ROOT_CLASS);

  const sync = () => {
    frame = null;
    if (disposed) return;
    // Do not reinterpret pinch zoom as a software keyboard or fight viewport panning.
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;

    const height = viewport && Number.isFinite(viewport.height) && viewport.height > 0
      ? viewport.height
      : window.innerHeight;
    const keyboardOccupiesViewport = hasKeyboardFocus() && window.innerHeight - height > 100;
    if (!keyboardOccupiesViewport && (window.scrollX || window.scrollY || root.scrollTop || body.scrollTop || viewport?.offsetTop)) {
      // iOS can retain a document offset after dismissal, including without input blur.
      // Only reset the document; gallery/job/editor scroll containers keep their positions.
      window.scrollTo(0, 0);
      root.scrollTop = 0;
      body.scrollTop = 0;
    }

    const top = viewport && Number.isFinite(viewport.offsetTop) ? Math.max(0, viewport.offsetTop) : 0;
    root.style.setProperty(HEIGHT_PROPERTY, `${height}px`);
    root.style.setProperty(TOP_PROPERTY, `${top}px`);
  };

  const schedule = () => {
    if (!disposed && frame === null) frame = window.requestAnimationFrame(sync);
  };
  const settle = () => {
    schedule();
    timers.forEach(window.clearTimeout);
    // Safari can finish its keyboard animation after focusout and the last resize event.
    timers = [100, 300, 600].map(delay => window.setTimeout(schedule, delay));
  };
  const restore = () => {
    if (document.visibilityState === 'visible') settle();
  };

  sync();
  window.addEventListener('resize', settle, { passive: true });
  window.addEventListener('orientationchange', settle, { passive: true });
  window.addEventListener('pageshow', settle);
  window.addEventListener('scroll', schedule, { passive: true });
  viewport?.addEventListener('resize', settle, { passive: true });
  viewport?.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('focusin', settle);
  document.addEventListener('focusout', settle);
  document.addEventListener('visibilitychange', restore);
  settle();

  return () => {
    disposed = true;
    if (frame !== null) window.cancelAnimationFrame(frame);
    timers.forEach(window.clearTimeout);
    window.removeEventListener('resize', settle);
    window.removeEventListener('orientationchange', settle);
    window.removeEventListener('pageshow', settle);
    window.removeEventListener('scroll', schedule);
    viewport?.removeEventListener('resize', settle);
    viewport?.removeEventListener('scroll', schedule);
    document.removeEventListener('focusin', settle);
    document.removeEventListener('focusout', settle);
    document.removeEventListener('visibilitychange', restore);
    if (!rootHadClass) root.classList.remove(ROOT_CLASS);
    if (!bodyHadClass) body.classList.remove(ROOT_CLASS);
    previousProperties.forEach(({ name, value, priority }) => {
      if (value) root.style.setProperty(name, value, priority);
      else root.style.removeProperty(name);
    });
    if (previousScroll.x || previousScroll.y) window.scrollTo(previousScroll.x, previousScroll.y);
  };
}
