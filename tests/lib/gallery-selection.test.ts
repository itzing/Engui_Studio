import { describe, expect, it, vi } from 'vitest';
import { resolveGallerySelection, galleryIndexAtPoint } from '@/lib/gallery/selection';
import { runGalleryBulkAction } from '@/lib/gallery/bulkActions';

const items = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [i, { id: `asset-${i}` }]));
const pick = (anchor: number, end: number, add = true, base = new Set<string>()) => resolveGallerySelection(base, { anchor, end, add, base }, items);

describe('gallery range selection', () => {
  it('selects a continuous range across rows and pages, including fast skipped tiles', () => {
    expect(pick(2, 50).ids.size).toBe(49);
    expect(pick(50, 2).ids).toEqual(pick(2, 50).ids);
  });
  it('contracts from the original selection when reversing and preserves other gestures', () => {
    const base = new Set(['asset-90']);
    expect(pick(2, 50, true, base).ids.size).toBe(50);
    expect(pick(2, 3, true, base).ids).toEqual(new Set(['asset-90', 'asset-2', 'asset-3']));
  });
  it('deselects without re-toggling on repeated crossings', () => {
    const base = pick(0, 20).ids;
    expect(pick(4, 14, false, base).ids.size).toBe(10);
    expect(pick(4, 5, false, base).ids.size).toBe(19);
    expect(base.size).toBe(21);
  });
  it('counts missing virtualized items until their IDs arrive', () => {
    const range = { anchor: 0, end: 4, add: true, base: new Set<string>() };
    expect(resolveGallerySelection(new Set(), range, { 0: items[0] }).missing).toBe(4);
    expect(resolveGallerySelection(new Set(), range, items).missing).toBe(0);
  });
  it('resolves scroll coordinates and clamps partial last rows', () => {
    const rect = { left: 20, top: 60, width: 600, height: 400 };
    expect(galleryIndexAtPoint(221, 161, rect, 400, 6, 100, 100)).toBe(32);
    expect(galleryIndexAtPoint(900, 1000, rect, 2000, 6, 100, 99)).toBe(98);
    expect(galleryIndexAtPoint(20, 60, rect, 0, 6, 100, 0)).toBeNull();
  });
});

describe('gallery bulk actions', () => {
  it('uses explicit state for mixed favorites, deduplicates and encodes IDs', async () => {
    const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true })));
    const result = await runGalleryBulkAction('ws', ['a/b', 'b', 'b'], 'favorite', request);
    expect(result.succeeded).toHaveLength(2);
    expect(request.mock.calls[0][0]).toContain('a%2Fb/favorite');
    for (const call of request.mock.calls) expect(JSON.parse(String(call[1]?.body))).toEqual({ favorited: true });
  });
  it('returns only failed IDs for retry; never calls permanent delete', async () => {
    const request = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/bad/')) throw new Error('offline');
      return new Response(JSON.stringify({ success: !url.includes('/rejected/') }));
    });
    const result = await runGalleryBulkAction('ws', ['ok', 'bad', 'rejected'], 'trash', request);
    expect(result.succeeded).toEqual(['ok']);
    expect(new Set(result.failed)).toEqual(new Set(['bad', 'rejected']));
    for (const call of request.mock.calls) {
      expect(call[0]).toMatch(/\/trash$/);
      expect(call[1]?.method).toBe('POST');
      expect(JSON.parse(String(call[1]?.body))).toEqual({ trashed: true });
    }
  });
  it('caps concurrency at four and covers every item', async () => {
    let active = 0, max = 0;
    const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      active++; max = Math.max(max, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return new Response(JSON.stringify({ success: true }));
    });
    const result = await runGalleryBulkAction('ws', Array.from({ length: 25 }, (_, i) => String(i)), 'restore', request);
    expect(max).toBe(4); expect(result.succeeded).toHaveLength(25);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ trashed: false });
  });
  it('unfavorites explicitly and treats non-2xx as failure', async () => {
    const request = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true }), { status: 500 }));
    expect((await runGalleryBulkAction('ws', ['a'], 'unfavorite', request)).failed).toEqual(['a']);
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ favorited: false });
  });
});
