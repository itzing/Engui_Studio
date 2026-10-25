/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMobileGalleryScreen } from '@/hooks/gallery/useMobileGalleryScreen';
import type { GalleryPosition } from '@/lib/mobile/galleryPosition';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), workspaceId: 'ws-1' }));
vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => ({ activeWorkspaceId: mocks.workspaceId, workspaces: [] }) }));
vi.mock('@/lib/workspaces/useWorkspaceFetch', () => ({ useWorkspaceFetch: () => mocks.fetch }));
const point: GalleryPosition = { version: 1, workspaceId: 'ws-1', assetId: 'anchor', viewportOffset: 37, filters: { query: 'portrait', selectedFilters: ['video'], semanticFilter: 'draft', showTrashed: false, favoritesOnly: true } };
function response(focus = false, found = true) {
  return { ok: true, json: async () => ({ success: true, assets: [{ id: focus && found ? 'anchor' : 'other', type: 'video', workspaceId: 'ws-1', originalUrl: '/image.png', favorited: true, trashed: false, addedToGalleryAt: '2026-10-25' }], pagination: { page: focus && found ? 5 : 1, limit: 24, totalCount: focus && found ? 97 : 1 }, ...(focus ? { focus: { assetId: 'anchor', found, absoluteIndex: found ? 96 : null } } : {}) }) };
}
beforeEach(() => {
  localStorage.clear(); mocks.workspaceId = 'ws-1'; mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async (url: string) => response(new URL(url, 'http://localhost').searchParams.has('focusAssetId')));
});
describe('mobile gallery explicit position restore', () => {
  it('restores saved search and filters in one focused request with the current index and offset', async () => {
    const { result } = renderHook(() => useMobileGalleryScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.fetch.mockClear();
    act(() => result.current.restorePosition(point));
    await waitFor(() => expect(result.current.positionRestoreResult?.status).toBe('restored'));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const query = new URL(mocks.fetch.mock.calls[0][0], 'http://localhost').searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ focusAssetId: 'anchor', q: 'portrait', type: 'video', bucket: 'draft', favoritesOnly: 'true' });
    expect(result.current.restoreAbsoluteIndex).toBe(96);
    expect(result.current.restoreViewportOffset).toBe(37);
    expect(result.current.query).toBe('portrait');
    // A later filter change must not reuse the explicit return request.
    mocks.fetch.mockClear();
    act(() => result.current.toggleMediaFilter('image'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(new URL(mocks.fetch.mock.calls[0][0], 'http://localhost').searchParams.has('focusAssetId')).toBe(false);
  });
  it('reports missing anchors without a false restored position', async () => {
    mocks.fetch.mockImplementation(async (url: string) => response(new URL(url, 'http://localhost').searchParams.has('focusAssetId'), false));
    const { result } = renderHook(() => useMobileGalleryScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.restorePosition(point));
    await waitFor(() => expect(result.current.positionRestoreResult?.status).toBe('missing'));
    expect(result.current.restoreAbsoluteIndex).toBeNull();
  });
  it('keeps a failed request retryable without declaring the anchor missing', async () => {
    const { result } = renderHook(() => useMobileGalleryScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'));
    act(() => result.current.restorePosition(point));
    await waitFor(() => expect(result.current.error).toBe('Offline'));
    expect(result.current.positionRestoreResult).toBeNull();
    act(() => result.current.restorePosition(point));
    await waitFor(() => expect(result.current.positionRestoreResult?.status).toBe('restored'));
  });
  it('ignores a return response superseded by a newer filter change', async () => {
    const { result } = renderHook(() => useMobileGalleryScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let finish!: (value: ReturnType<typeof response>) => void;
    mocks.fetch.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    act(() => result.current.restorePosition(point));
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    act(() => result.current.setQuery('different search'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => { finish(response(true)); });
    expect(result.current.query).toBe('different search');
    expect(result.current.positionRestoreResult).toBeNull();
    expect(result.current.restoreAbsoluteIndex).toBeNull();
  });
  it('does not apply another workspace point or expose return behavior on desktop', async () => {
    const { result } = renderHook(() => useMobileGalleryScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    mocks.fetch.mockClear();
    act(() => result.current.restorePosition({ ...point, workspaceId: 'ws-other' }));
    expect(mocks.fetch).not.toHaveBeenCalled();
    const desktop = renderHook(() => useMobileGalleryScreen('desktop'));
    await waitFor(() => expect(desktop.result.current.isLoading).toBe(false));
    mocks.fetch.mockClear();
    act(() => desktop.result.current.restorePosition(point));
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
