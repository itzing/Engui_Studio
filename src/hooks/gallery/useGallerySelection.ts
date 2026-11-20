'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { galleryIndexAtPoint, resolveGallerySelection, type SelectionRange } from '@/lib/gallery/selection';

type Gesture = SelectionRange & { pointerId: number; dragging: boolean; x: number; y: number };
type Options = {
  scope: string; enabled: boolean; busy: boolean;
  items: Record<number, { id: string }>; total: number; columns: number; rowHeight: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  ensureRangeLoaded: (start: number, end: number) => Promise<unknown>;
};

export function useGallerySelection(options: Options) {
  const [active, setActive] = useState(false);
  const [base, setBase] = useState<Set<string>>(new Set());
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const anchorRef = useRef<number | null>(null);
  const scopeRef = useRef(options.scope);
  const current = useRef(options);
  current.current = options;
  const setGesture = useCallback((value: Gesture | null) => { gestureRef.current = value; setGestureState(value); }, []);
  const scopeMatches = scopeRef.current === options.scope && options.enabled;
  const resolved = useMemo(() => resolveGallerySelection(scopeMatches ? base : new Set(), scopeMatches ? gesture : null, options.items), [base, gesture, options.items, scopeMatches]);
  const selectedRef = useRef(resolved.ids);
  selectedRef.current = resolved.ids;

  const reset = useCallback(() => {
    setGesture(null); setBase(new Set()); anchorRef.current = null;
  }, [setGesture]);
  const done = useCallback(() => { reset(); setActive(false); }, [reset]);

  useEffect(() => {
    if (scopeRef.current !== options.scope || !options.enabled) {
      scopeRef.current = options.scope;
      done();
    }
  }, [done, options.enabled, options.scope]);

  useEffect(() => {
    if (!gesture || !scopeMatches) return;
    if (resolved.missing > 0) {
      void options.ensureRangeLoaded(Math.min(gesture.anchor, gesture.end), Math.max(gesture.anchor, gesture.end));
    } else if (!gesture.dragging) {
      setBase(resolved.ids); setGesture(null);
    }
  }, [gesture, options.ensureRangeLoaded, resolved, scopeMatches, setGesture]);

  const finish = useCallback((cancel = false) => {
    const g = gestureRef.current;
    if (!g) return;
    if (cancel) { setBase(g.base); setGesture(null); }
    else setGesture({ ...g, dragging: false });
    const node = current.current.scrollRef.current;
    if (node?.hasPointerCapture?.(g.pointerId)) node.releasePointerCapture(g.pointerId);
  }, [setGesture]);

  useEffect(() => { if (options.busy && gestureRef.current?.dragging) finish(true); }, [options.busy, finish]);

  const updatePointer = useCallback((x: number, y: number) => {
    const g = gestureRef.current;
    const o = current.current;
    const node = o.scrollRef.current;
    if (!g?.dragging || !node) return;
    const rect = node.getBoundingClientRect();
    // Leaving the grid horizontally pauses the gesture, not selecting hidden columns.
    if (x < rect.left || x > rect.right) { g.x = x; g.y = y; return; }
    const end = galleryIndexAtPoint(x, y, { left: rect.left, top: rect.top, height: rect.height, width: node.clientWidth }, node.scrollTop, o.columns, o.rowHeight, o.total);
    if (end !== null && (end !== g.end || x !== g.x || y !== g.y)) setGesture({ ...g, end, x, y });
  }, [setGesture]);

  useEffect(() => {
    if (!gesture?.dragging) return;
    let frame = 0;
    let previous = 0;
    const tick = (now: number) => {
      const g = gestureRef.current;
      const node = current.current.scrollRef.current;
      if (!g?.dragging || !node) return;
      const rect = node.getBoundingClientRect();
      const dt = previous ? Math.min(40, now - previous) : 16;
      previous = now;
      if (g.x >= rect.left && g.x <= rect.right) {
        const edge = Math.min(56, rect.height / 4);
        const speed = g.y < rect.top + edge ? -Math.min(1, (rect.top + edge - g.y) / edge)
          : g.y > rect.bottom - edge ? Math.min(1, (g.y - rect.bottom + edge) / edge) : 0;
        if (speed) { node.scrollTop += speed * dt * 0.9; updatePointer(g.x, g.y); }
      }
      frame = requestAnimationFrame(tick);
    };
    const cancel = () => finish(true);
    const release = (event: globalThis.PointerEvent) => {
      if (event.pointerId === gestureRef.current?.pointerId) finish();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    frame = requestAnimationFrame(tick);
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [gesture?.dragging, finish, updatePointer]);

  const pointerDown = (event: PointerEvent, index: number) => {
    if (!active || options.busy || resolved.missing || event.button !== 0 || !options.items[index]) return;
    event.preventDefault();
    const add = event.shiftKey || !selectedRef.current.has(options.items[index].id);
    const anchor = event.shiftKey && anchorRef.current !== null ? anchorRef.current : index;
    if (!event.shiftKey) anchorRef.current = index;
    setGesture({ base: new Set(selectedRef.current), anchor, end: index, add, pointerId: event.pointerId, dragging: true, x: event.clientX, y: event.clientY });
    options.scrollRef.current?.setPointerCapture?.(event.pointerId);
  };
  const keyboardToggle = (index: number, shift: boolean) => {
    if (options.busy || resolved.missing || !options.items[index]) return;
    const anchor = shift && anchorRef.current !== null ? anchorRef.current : index;
    if (!shift) anchorRef.current = index;
    setGesture({ base: new Set(selectedRef.current), anchor, end: index, add: shift || !selectedRef.current.has(options.items[index].id), pointerId: -1, dragging: false, x: 0, y: 0 });
  };

  return {
    active, start: () => { reset(); setActive(true); }, done, clear: reset,
    ids: resolved.ids, pending: resolved.missing > 0, dragging: !!gesture?.dragging,
    replace: (ids: string[]) => { setGesture(null); setBase(new Set(ids)); anchorRef.current = null; },
    pointerDown, keyboardToggle,
    pointerMove: (event: PointerEvent) => {
      if (gestureRef.current?.pointerId === event.pointerId) updatePointer(event.clientX, event.clientY);
    },
    pointerUp: (event: PointerEvent) => { if (gestureRef.current?.pointerId === event.pointerId) finish(); },
    pointerCancel: () => finish(true),
  };
}
