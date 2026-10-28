/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installStandalonePhoneHeight } from '@/lib/mobile/standalonePhoneHeight';

const property = '--engui-standalone-phone-height';
let dispose = () => {};
let orientation: EventTarget & { angle: number };
function value(object: object, key: string, next: unknown) {
  Object.defineProperty(object, key, { configurable: true, value: next });
}
function resize(height: number) {
  value(window, 'innerHeight', height);
  window.dispatchEvent(new Event('resize'));
}
const cssHeight = () => document.body.style.getPropertyValue(property);

beforeEach(() => {
  document.body.style.removeProperty(property);
  value(navigator, 'userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)');
  value(navigator, 'standalone', true);
  value(window, 'innerWidth', 402);
  value(window, 'innerHeight', 874);
  value(window.screen, 'width', 402);
  value(window.screen, 'height', 874);
  orientation = Object.assign(new EventTarget(), { angle: 0 });
  value(window.screen, 'orientation', orientation);
  value(window, 'matchMedia', vi.fn().mockReturnValue({ matches: false }));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { dispose(); dispose = () => {}; vi.restoreAllMocks(); });

describe('installed iPhone shell height', () => {
  it('preserves full screen through the captured keyboard and dismissal sizes at zero root scroll', () => {
    dispose = installStandalonePhoneHeight();
    for (const height of [874, 692, 812, 825, 857, 874, 751, 812, 838]) {
      resize(height);
      expect(cssHeight()).toBe('874px');
    }
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('recovers sizing on launch already stuck at 812 without needing a known good initial viewport', () => {
    resize(812);
    dispose = installStandalonePhoneHeight();
    expect(cssHeight()).toBe('874px');
  });
  it('does not fight manual overscroll or change nested scroll and focused input', () => {
    const inner = document.createElement('div');
    const editor = document.createElement('textarea'); inner.append(editor); document.body.append(inner);
    inner.scrollTop = 240; editor.focus();
    value(window, 'scrollY', -13);
    dispose = installStandalonePhoneHeight();
    resize(825); document.dispatchEvent(new Event('focusout')); window.dispatchEvent(new Event('scroll'));
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(-13); expect(inner.scrollTop).toBe(240);
    expect(document.activeElement).toBe(editor); inner.remove(); value(window, 'scrollY', 0);
  });
  it('follows physical rotation rather than keyboard aspect ratio', () => {
    dispose = installStandalonePhoneHeight();
    resize(300); expect(cssHeight()).toBe('874px');
    orientation.angle = 90; orientation.dispatchEvent(new Event('change'));
    expect(cssHeight()).toBe('402px');
    orientation.angle = 180; window.dispatchEvent(new Event('orientationchange'));
    expect(cssHeight()).toBe('874px');
  });
  it('supports older iOS orientation and standalone display mode detection', () => {
    value(navigator, 'standalone', undefined);
    value(window, 'matchMedia', vi.fn().mockImplementation(query => ({ matches: query === '(display-mode: standalone)' })));
    value(window.screen, 'orientation', undefined); value(window, 'orientation', -90);
    dispose = installStandalonePhoneHeight();
    expect(cssHeight()).toBe('402px'); value(window, 'orientation', undefined);
  });
  it.each([
    ['normal Safari', 'iPhone', false],
    ['iPad standalone', 'iPad', true],
    ['Android standalone', 'Linux; Android', true],
    ['desktop standalone', 'Macintosh', true],
  ])('does not override %s', (_, userAgent, standalone) => {
    value(navigator, 'userAgent', userAgent); value(navigator, 'standalone', standalone);
    dispose = installStandalonePhoneHeight(); resize(812);
    expect(cssHeight()).toBe(''); expect(window.scrollTo).not.toHaveBeenCalled();
  });
  it('leaves CSS fallback when screen dimensions are unavailable', () => {
    value(window.screen, 'height', 0); dispose = installStandalonePhoneHeight();
    expect(cssHeight()).toBe('');
  });
  it('restores prior styles and removes listeners on unmount', () => {
    document.body.style.setProperty(property, '900px', 'important');
    dispose = installStandalonePhoneHeight(); expect(cssHeight()).toBe('874px');
    dispose(); dispose = () => {};
    expect(cssHeight()).toBe('900px'); expect(document.body.style.getPropertyPriority(property)).toBe('important');
    resize(812); orientation.angle = 90; orientation.dispatchEvent(new Event('change'));
    expect(cssHeight()).toBe('900px');
  });
});
