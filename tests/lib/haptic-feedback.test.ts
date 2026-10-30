/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pulseHapticFeedback } from '@/lib/mobile/hapticFeedback';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function vibration(result: boolean | Error) {
  const fn = vi.fn(() => { if (result instanceof Error) throw result; return result; });
  vi.spyOn(navigator, 'vibrate', 'get').mockReturnValue(fn);
  return fn;
}
// JSDOM does not implement the Vibration API or Safari switch extension.
Object.defineProperty(navigator, 'vibrate', { configurable: true, get: () => undefined });

describe('optional haptic feedback', () => {
  it('requests one short vibration without adding DOM controls', () => {
    const vibrate = vibration(true);
    pulseHapticFeedback();
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(15);
    expect(document.body.children).toHaveLength(0);
  });
  it.each([false, new Error('Denied')])('tolerates unsupported or denied vibration (%s)', result => {
    vibration(result);
    expect(() => pulseHapticFeedback()).not.toThrow();
    expect(document.body.children).toHaveLength(0);
  });
  it('activates a hidden native switch once, preserves focus, and cleans up immediately', () => {
    const field = document.createElement('textarea'); document.body.append(field); field.focus();
    const create = document.createElement.bind(document);
    let activated = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag);
      if (tag === 'input') {
        Object.defineProperty(element, 'switch', { value: false });
        element.addEventListener('click', () => {
          activated++;
          expect(element.getAttribute('switch')).toBe('');
          expect(element.tabIndex).toBe(-1);
          expect(element.parentElement?.style.display).toBe('none');
          expect(element.parentElement?.getAttribute('aria-hidden')).toBe('true');
          expect(element.isConnected).toBe(true);
        });
      }
      return element;
    });
    pulseHapticFeedback();
    expect(activated).toBe(1);
    expect(document.activeElement).toBe(field);
    expect(document.querySelector('input[switch]')).toBeNull();
    expect(document.body.children).toHaveLength(1);
  });
});
