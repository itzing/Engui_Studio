/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMobileKeyboardRecovery } from '@/lib/mobile/mobileKeyboardRecovery';

let controller: ReturnType<typeof installMobileKeyboardRecovery>;
let viewport: EventTarget & { height: number; scale: number; offsetTop: number };
let input: HTMLTextAreaElement;
let nested: HTMLDivElement;

function drift(y = 80) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  document.documentElement.scrollTop = y;
}
function resize(height: number) {
  viewport.height = height;
  viewport.dispatchEvent(new Event('resize'));
}
function openKeyboard() {
  input.focus();
  resize(440);
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  Object.defineProperty(document, 'scrollingElement', { configurable: true, value: document.documentElement });
  viewport = Object.assign(new EventTarget(), { height: 844, scale: 1, offsetTop: 0 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
  document.body.innerHTML = '<textarea></textarea><div id="nested"></div>';
  input = document.querySelector('textarea')!;
  nested = document.querySelector('#nested')!;
  nested.scrollTop = 400;
  drift(0);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => { drift(0); viewport.offsetTop = 0; });
  controller = installMobileKeyboardRecovery();
});

afterEach(() => {
  controller.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('mobile keyboard dismissal recovery', () => {
  it('restores residual document pan after dismissal without touching inner scroll', () => {
    openKeyboard();
    drift();
    input.blur();
    resize(844);
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
    expect(nested.scrollTop).toBe(400);
    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not fight the still-open keyboard during focusout animation', () => {
    openKeyboard();
    drift();
    input.blur();
    vi.advanceTimersByTime(350);
    expect(window.scrollTo).not.toHaveBeenCalled();
    resize(844);
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('recovers dismissal without blur, preserving the focused editor', () => {
    openKeyboard();
    drift();
    resize(844);
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
    expect(document.activeElement).toBe(input);
  });

  it('handles late dismissal geometry with no final resize event', () => {
    openKeyboard();
    drift();
    input.blur();
    vi.advanceTimersByTime(200);
    viewport.height = 844;
    vi.advanceTimersByTime(500);
    expect(window.scrollY).toBe(0);
  });

  it('recovers route removal of an editor without a focusout event', () => {
    openKeyboard();
    input.remove();
    drift();
    controller.schedule();
    viewport.height = 844;
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('ignores ordinary scroll and same-size resize to avoid correction loops', () => {
    drift();
    window.dispatchEvent(new Event('scroll'));
    viewport.dispatchEvent(new Event('scroll'));
    viewport.dispatchEvent(new Event('resize'));
    vi.runAllTimers();
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('leaves pinch-zoom panning alone and settles after zoom returns', () => {
    openKeyboard();
    drift();
    viewport.scale = 2;
    resize(844);
    vi.runAllTimers();
    expect(window.scrollTo).not.toHaveBeenCalled();
    viewport.scale = 1;
    viewport.dispatchEvent(new Event('resize'));
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('does not treat autofocus without keyboard geometry as dismissal', () => {
    input.focus();
    drift();
    vi.runAllTimers();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('supports layout viewport resize as well as visual-only keyboard resize', () => {
    input.focus();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 440 });
    resize(440);
    drift();
    vi.runAllTimers();
    expect(window.scrollTo).not.toHaveBeenCalled();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    resize(844);
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('rebases full height on orientation changes', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 844 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 390 });
    drift();
    resize(390);
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('supports browsers without visualViewport on blur and navigation', () => {
    controller.dispose();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    controller = installMobileKeyboardRecovery();
    input.focus();
    input.blur();
    drift();
    vi.runAllTimers();
    expect(window.scrollY).toBe(0);
  });

  it('cleans up pending attempts and all event paths on mobile exit', () => {
    controller.schedule();
    expect(vi.getTimerCount()).toBe(4);
    controller.dispose();
    drift();
    input.focus();
    input.blur();
    resize(600);
    window.dispatchEvent(new Event('pageshow'));
    controller.schedule();
    vi.runAllTimers();
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
