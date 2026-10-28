import { VIEWPORT_DIAGNOSTICS_UNTIL } from './viewportDiagnostics';

/** Temporary geometry-only capture. It never reads field values or changes layout/scroll. */
export function installMobileViewportDiagnostics() {
  if (Date.now() >= VIEWPORT_DIAGNOSTICS_UNTIL) return () => {};
  const page = Math.random().toString(36).slice(2, 12);
  const started = performance.now();
  const ios = navigator.userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) (\d+)_(\d+)/);
  const timers = new Set<number>();
  let lastSent = -Infinity;
  let count = 0;
  let disposed = false;
  const viewport = window.visualViewport;

  const capture = (event: string) => {
    if (disposed || count >= 80 || Date.now() >= VIEWPORT_DIAGNOSTICS_UNTIL) return;
    if (performance.now() - lastSent < 180) return;
    lastSent = performance.now();
    count++;
    try {
      const root = document.documentElement;
      const body = document.body.getBoundingClientRect();
      const shell = document.querySelector('[data-form-factor]')?.getBoundingClientRect();
      const navElement = [...document.querySelectorAll('nav')].find(nav => nav.querySelector('a[href="/m/jobs"]'));
      const nav = navElement?.getBoundingClientRect();
      const grid = navElement?.firstElementChild?.getBoundingClientRect();
      const pathname = window.location.pathname;
      const screen = pathname === '/m/create/prompt' ? 'prompt'
        : pathname === '/m/create' ? 'create' : pathname === '/m/jobs' ? 'jobs'
        : pathname === '/m/gallery' ? 'gallery' : pathname === '/m/carousel' ? 'carousel' : 'other';
      const active = document.activeElement;
      const metrics = {
        seq: count, elapsed: performance.now() - started,
        standalone: Number((navigator as Navigator & { standalone?: boolean }).standalone || window.matchMedia('(display-mode: standalone)').matches),
        iosMajor: Number(ios?.[1] || 0), iosMinor: Number(ios?.[2] || 0),
        focused: Number(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable)),
        dpr: window.devicePixelRatio, screenWidth: window.screen.width, screenHeight: window.screen.height,
        availableHeight: window.screen.availHeight, innerWidth: window.innerWidth, innerHeight: window.innerHeight, outerHeight: window.outerHeight,
        visualHeight: viewport?.height, visualWidth: viewport?.width, visualTop: viewport?.offsetTop,
        visualPageTop: viewport?.pageTop, visualScale: viewport?.scale, scrollX: window.scrollX, scrollY: window.scrollY,
        rootClientHeight: root.clientHeight, rootScrollHeight: root.scrollHeight, rootScrollTop: root.scrollTop,
        rootMinHeight: parseFloat(getComputedStyle(root).minHeight),
        bodyTop: body.top, bodyBottom: body.bottom, bodyHeight: body.height, bodyScrollTop: document.body.scrollTop,
        shellTop: shell?.top, shellBottom: shell?.bottom, shellHeight: shell?.height,
        navTop: nav?.top, navBottom: nav?.bottom, navHeight: nav?.height,
        navPaddingBottom: navElement ? parseFloat(getComputedStyle(navElement).paddingBottom) : undefined,
        navGridBottom: grid?.bottom,
      };
      void fetch('/api/diagnostics/mobile-viewport', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        cache: 'no-store', keepalive: true, body: JSON.stringify({ page, event, screen, metrics }),
      }).catch(() => {});
    } catch {
      // Diagnostics must never affect application availability.
    }
  };
  const changed = (event: Event) => {
    capture(event.type);
    // Delayed snapshots reveal geometry that settles after the final browser event.
    for (const timer of timers) window.clearTimeout(timer);
    timers.clear();
    for (const delay of [350, 1000, 2000]) {
      const timer = window.setTimeout(() => { timers.delete(timer); capture('settle'); }, delay);
      timers.add(timer);
    }
  };
  const targets: Array<[EventTarget, string]> = [
    [document, 'focusin'], [document, 'focusout'], [window, 'resize'],
    [window, 'scroll'], [window, 'pageshow'],
  ];
  if (viewport) targets.push([viewport, 'resize'], [viewport, 'scroll']);
  for (const [target, event] of targets) target.addEventListener(event, changed, { passive: true });
  capture('mount');

  return () => {
    disposed = true;
    for (const timer of timers) window.clearTimeout(timer);
    for (const [target, event] of targets) target.removeEventListener(event, changed);
  };
}
