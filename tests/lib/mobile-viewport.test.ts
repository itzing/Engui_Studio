/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMobileViewport } from '@/lib/mobile/mobileViewport';

class TestViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
}

let viewport: TestViewport;
let dispose: (() => void) | undefined;
const height = () => document.documentElement.style.getPropertyValue('--engui-mobile-viewport-height');
const top = () => document.documentElement.style.getPropertyValue('--engui-mobile-viewport-top');
const flush = () => vi.advanceTimersByTime(1);

function focusEditor() {
  const editor = document.createElement('textarea');
  document.body.appendChild(editor);
  editor.focus();
  flush();
  return editor;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  document.body.className = 'existing-body';
  document.documentElement.className = 'existing-root';
  document.documentElement.removeAttribute('style');
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  viewport = new TestViewport();
  vi.stubGlobal('innerHeight', 844);
  vi.stubGlobal('scrollX', 0);
  vi.stubGlobal('scrollY', 0);
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  vi.stubGlobal('scrollTo', vi.fn((x: number, y: number) => {
    vi.stubGlobal('scrollX', x);
    vi.stubGlobal('scrollY', y);
    viewport.offsetTop = 0;
  }));
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('mobile viewport lifecycle', () => {
  it('locks only the mobile document and measures the initial viewport', () => {
    dispose = installMobileViewport();
    expect(document.documentElement.classList.contains('engui-mobile-shell')).toBe(true);
    expect(document.body.classList.contains('engui-mobile-shell')).toBe(true);
    expect(height()).toBe('844px');
    expect(top()).toBe('0px');
  });

  it('follows keyboard height and panning without blurring the editor', () => {
    dispose = installMobileViewport();
    const editor = focusEditor();
    viewport.height = 420;
    viewport.offsetTop = 90;
    vi.stubGlobal('scrollY', 40);
    viewport.dispatchEvent(new Event('resize'));
    viewport.dispatchEvent(new Event('scroll'));
    flush();
    expect(height()).toBe('420px');
    expect(top()).toBe('90px');
    expect(document.activeElement).toBe(editor);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('recovers after dismissal even when the input remains focused and preserves inner scroll', () => {
    dispose = installMobileViewport();
    const editor = focusEditor();
    const list = document.createElement('div');
    document.body.appendChild(list);
    list.scrollTop = 1800;
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    viewport.height = 844;
    viewport.offsetTop = 70;
    vi.stubGlobal('scrollY', 70);
    document.documentElement.scrollTop = 70;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(height()).toBe('844px');
    expect(top()).toBe('0px');
    expect(list.scrollTop).toBe(1800);
    expect(document.activeElement).toBe(editor);
  });

  it('resamples delayed iOS viewport restoration after blur without another resize event', () => {
    dispose = installMobileViewport();
    const editor = focusEditor();
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    editor.blur();
    flush();
    viewport.height = 844;
    viewport.offsetTop = 80;
    vi.stubGlobal('scrollY', 80);
    vi.advanceTimersByTime(350);
    expect(height()).toBe('844px');
    expect(top()).toBe('0px');
    expect(window.scrollY).toBe(0);
  });

  it('repairs residual document scrolling on another mobile screen with no focused input', () => {
    dispose = installMobileViewport();
    vi.stubGlobal('scrollY', 80);
    viewport.offsetTop = 80;
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(window.scrollY).toBe(0);
    expect(top()).toBe('0px');
  });

  it('recovers a visual viewport offset even when the document reports zero scroll', () => {
    dispose = installMobileViewport();
    viewport.offsetTop = 80;
    viewport.dispatchEvent(new Event('scroll'));
    flush();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(top()).toBe('0px');
  });

  it('updates for orientation and page restoration', () => {
    dispose = installMobileViewport();
    vi.stubGlobal('innerHeight', 390);
    viewport.height = 390;
    window.dispatchEvent(new Event('orientationchange'));
    flush();
    expect(height()).toBe('390px');
    vi.stubGlobal('innerHeight', 844);
    viewport.height = 844;
    window.dispatchEvent(new Event('pageshow'));
    flush();
    expect(height()).toBe('844px');
  });

  it('settles a route change that removes the focused input without blur or resize', () => {
    dispose = installMobileViewport();
    const editor = focusEditor();
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
    vi.advanceTimersByTime(1000);
    editor.remove();
    dispose();
    dispose = installMobileViewport();
    viewport.height = 844;
    vi.advanceTimersByTime(350);
    expect(height()).toBe('844px');
  });

  it('uses the layout viewport when visualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined);
    dispose = installMobileViewport();
    expect(height()).toBe('844px');
    vi.stubGlobal('innerHeight', 700);
    window.dispatchEvent(new Event('resize'));
    flush();
    expect(height()).toBe('700px');
  });

  it('does not treat pinch zoom as keyboard dismissal or reset zoom panning', () => {
    dispose = installMobileViewport();
    viewport.scale = 2;
    viewport.height = 422;
    viewport.offsetTop = 100;
    vi.stubGlobal('scrollY', 100);
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(height()).toBe('844px');
    expect(window.scrollTo).not.toHaveBeenCalled();
    viewport.scale = 1;
    viewport.height = 844;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(window.scrollY).toBe(0);
  });

  it('cleans up classes, CSS values, pending frames and listeners when leaving mobile', () => {
    document.documentElement.style.setProperty('--engui-mobile-viewport-top', '5px', 'important');
    dispose = installMobileViewport();
    focusEditor();
    viewport.height = 420;
    viewport.dispatchEvent(new Event('resize'));
    dispose();
    dispose = undefined;
    vi.runAllTimers();
    expect(document.body.className).toBe('existing-body');
    expect(document.documentElement.className).toBe('existing-root');
    expect(height()).toBe('');
    expect(top()).toBe('5px');
    expect(document.documentElement.style.getPropertyPriority('--engui-mobile-viewport-top')).toBe('important');
    viewport.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('scroll'));
    vi.runAllTimers();
    expect(height()).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores the original desktop root position on unmount', () => {
    vi.stubGlobal('scrollY', 230);
    dispose = installMobileViewport();
    expect(window.scrollY).toBe(0);
    dispose();
    dispose = undefined;
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 230);
  });

  it('ignores transient invalid visual viewport measurements', () => {
    dispose = installMobileViewport();
    viewport.height = 0;
    viewport.offsetTop = -10;
    viewport.dispatchEvent(new Event('resize'));
    flush();
    expect(height()).toBe('844px');
    expect(top()).toBe('0px');
  });
});
