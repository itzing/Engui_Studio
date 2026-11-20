/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PointerEvent } from 'react';
import { useGallerySelection } from '@/hooks/gallery/useGallerySelection';
const pointer = (x = 10, y = 10, shiftKey = false) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, shiftKey, preventDefault: vi.fn() } as unknown as PointerEvent);
function setup(items: Record<number, { id: string }> = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, { id: String(i) }]))) {
  const node = document.createElement('div');
  node.getBoundingClientRect = () => ({ left: 0, right: 600, top: 0, bottom: 400, width: 600, height: 400 } as DOMRect);
  Object.defineProperty(node, 'clientWidth', { value: 600 });
  const initial = { scope: 'ws:all', enabled: true, busy: false, items, total: 100, columns: 6, rowHeight: 100, scrollRef: { current: node }, ensureRangeLoaded: vi.fn(async () => {}) };
  const hook = renderHook((props) => useGallerySelection(props), { initialProps: initial });
  act(() => hook.result.current.start());
  return { ...hook, initial, node };
}
describe('gallery pointer selection lifecycle', () => {
  it('ignores normal mode, selects a dragged range and contracts on reverse', () => {
    const h = setup();
    act(() => h.result.current.done());
    act(() => h.result.current.pointerDown(pointer(), 0));
    expect(h.result.current.ids.size).toBe(0);
    act(() => h.result.current.start());
    act(() => h.result.current.pointerDown(pointer(), 0));
    act(() => h.result.current.pointerMove(pointer(210, 110)));
    expect(h.result.current.ids.size).toBe(9);
    act(() => h.result.current.pointerMove(pointer(110, 10)));
    expect(h.result.current.ids.size).toBe(2);
    act(() => h.result.current.pointerUp(pointer()));
    expect(h.result.current.dragging).toBe(false);
    expect(h.result.current.ids.size).toBe(2);
    h.unmount();
  });
  it('adds a second range and deselects from an already selected tile', () => {
    const h = setup();
    act(() => h.result.current.keyboardToggle(0, false));
    act(() => h.result.current.keyboardToggle(5, true));
    expect(h.result.current.ids.size).toBe(6);
    act(() => h.result.current.keyboardToggle(10, false));
    expect(h.result.current.ids.size).toBe(7);
    act(() => h.result.current.pointerDown(pointer(110, 10), 1));
    act(() => h.result.current.pointerMove(pointer(310, 10)));
    act(() => h.result.current.pointerUp(pointer()));
    expect(h.result.current.ids).toEqual(new Set(['0', '4', '5', '10']));
    h.unmount();
  });
  it('waits for missing page IDs after release; does not silently select only mounted tiles', () => {
    const h = setup({ 0: { id: '0' } });
    act(() => h.result.current.pointerDown(pointer(), 0));
    act(() => h.result.current.pointerMove(pointer(210, 10)));
    act(() => h.result.current.pointerUp(pointer()));
    expect(h.result.current.pending).toBe(true);
    expect(h.initial.ensureRangeLoaded).toHaveBeenCalledWith(0, 2);
    h.rerender({ ...h.initial, items: { 0: { id: '0' }, 1: { id: '1' }, 2: { id: '2' } } });
    expect(h.result.current.pending).toBe(false);
    expect(h.result.current.ids.size).toBe(3);
    h.unmount();
  });
  it('cancels the current drag on blur and resets on scope change or close', () => {
    const h = setup();
    act(() => h.result.current.keyboardToggle(9, false));
    act(() => h.result.current.pointerDown(pointer(), 0));
    act(() => window.dispatchEvent(new Event('blur')));
    expect(h.result.current.ids).toEqual(new Set(['9']));
    h.rerender({ ...h.initial, scope: 'other-workspace' });
    expect(h.result.current.active).toBe(false); expect(h.result.current.ids.size).toBe(0);
    act(() => h.result.current.start());
    act(() => h.result.current.keyboardToggle(1, false));
    h.rerender({ ...h.initial, scope: 'other-workspace', enabled: false });
    expect(h.result.current.active).toBe(false); expect(h.result.current.ids.size).toBe(0);
    h.unmount();
  });
  it('retains failed IDs by identity across reordered/virtualized data and blocks edits while busy', () => {
    const h = setup();
    act(() => h.result.current.replace(['4', '9']));
    h.rerender({ ...h.initial, busy: true, items: { 0: { id: '9' }, 1: { id: '4' } } });
    act(() => h.result.current.keyboardToggle(0, false));
    expect(h.result.current.ids).toEqual(new Set(['4', '9']));
    h.unmount();
  });
});
