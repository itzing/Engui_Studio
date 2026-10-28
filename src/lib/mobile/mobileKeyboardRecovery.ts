function isEditable(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly
      && ['text', 'search', 'email', 'url', 'tel', 'number', 'password'].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Recover Safari's residual document pan without taking ownership of layout or inner scrolling. */
export function installMobileKeyboardRecovery() {
  const viewport = window.visualViewport;
  let fullHeight = window.innerHeight;
  let width = window.innerWidth;
  let sawKeyboard = false;
  let disposed = false;
  let timers: number[] = [];

  const observe = () => {
    if (width !== window.innerWidth) {
      width = window.innerWidth;
      fullHeight = window.innerHeight;
      sawKeyboard = false;
    }
    const height = viewport?.height || window.innerHeight;
    const keyboardOpen = Math.max(fullHeight, window.innerHeight) - height > 100;
    if (keyboardOpen && isEditable(document.activeElement)) sawKeyboard = true;
    return keyboardOpen;
  };

  const recover = () => {
    if (disposed || document.visibilityState === 'hidden') return;
    if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;
    if (observe()) return;
    // A focused input alone is not evidence of a dismissed keyboard (hardware keyboards, autofocus).
    if (isEditable(document.activeElement) && !sawKeyboard) return;
    fullHeight = window.innerHeight;
    const root = document.scrollingElement;
    if (window.scrollY || window.scrollX || root?.scrollTop || document.body.scrollTop || viewport?.offsetTop) {
      window.scrollTo(0, 0);
    }
  };

  const clearTimers = () => {
    timers.forEach(timer => window.clearTimeout(timer));
    timers = [];
  };
  const schedule = () => {
    if (disposed) return;
    observe();
    clearTimers();
    // A finite settle window covers keyboard animation, including late geometry with no final event.
    timers = [0, 120, 350, 700].map(delay => window.setTimeout(recover, delay));
  };
  const geometry = () => [window.innerWidth, window.innerHeight, viewport?.height, viewport?.scale].join(':');
  let lastGeometry = geometry();
  const resized = () => {
    const next = geometry();
    // A scroll correction must not feed a same-size viewport resize loop.
    if (next === lastGeometry) return;
    lastGeometry = next;
    schedule();
  };
  const focusChanged = (event: FocusEvent) => {
    if (event.target instanceof Element && isEditable(event.target)) schedule();
  };
  const visible = () => {
    if (document.visibilityState === 'visible') schedule();
  };

  document.addEventListener('focusin', focusChanged);
  document.addEventListener('focusout', focusChanged);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('resize', resized, { passive: true });
  window.addEventListener('pageshow', schedule);
  viewport?.addEventListener('resize', resized, { passive: true });

  return {
    schedule,
    dispose() {
      disposed = true;
      clearTimers();
      document.removeEventListener('focusin', focusChanged);
      document.removeEventListener('focusout', focusChanged);
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('resize', resized);
      window.removeEventListener('pageshow', schedule);
      viewport?.removeEventListener('resize', resized);
    },
  };
}
