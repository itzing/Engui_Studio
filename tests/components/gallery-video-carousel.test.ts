/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GalleryVideoCarousel } from '@/components/workspace/GalleryVideoCarousel';

describe('GalleryVideoCarousel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    window.cancelAnimationFrame = (id: number) => window.clearTimeout(id);
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve()) as any;
    HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('loads all videos and pauses carousel movement without pausing visible videos', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    fireEvent.click(screen.getByTestId('gallery-video-carousel'));

    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
    expect(screen.getByText('Movement paused')).toBeTruthy();
    expect(within(screen.getByTestId('gallery-video-carousel')).queryByText('Paused')).toBeNull();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    await waitFor(() => expect(screen.queryByTestId('gallery-carousel-pause-indicator')).toBeNull());
  });

  it('pauses movement and keeps it paused after dragging the tape', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
          {
            id: 'video-2',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-2.mp4',
            previewUrl: '/video-2.mp4',
            thumbnailUrl: '/video-2.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:01:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 2, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 120 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 172 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', clientX: 172 });

    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();
    expect(screen.getByText('Movement paused')).toBeTruthy();
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  });

  it('scrubs with held physical arrow keys and ignores keyboard shortcuts from form controls', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    expect(screen.queryByRole('button', { name: 'Move carousel tape right' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move carousel tape left' })).toBeNull();
    expect(screen.getByText('Scrub')).toBeTruthy();
    expect(screen.getByText('4x')).toBeTruthy();

    const stage = screen.getByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video')?.parentElement?.style.transform).toContain('translate3d'));
    fireEvent.click(stage);
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    const slot = stage.querySelector('video')?.parentElement as HTMLElement;
    const pausedTransform = slot.style.transform;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => expect(slot.style.transform).not.toBe(pausedTransform));
    const scrubbedTransform = slot.style.transform;
    fireEvent.keyUp(window, { key: 'ArrowRight' });
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    expect(slot.style.transform).toBe(scrubbedTransform);

    fireEvent.keyDown(screen.getByLabelText('Include image slots'), { key: 'ArrowLeft' });
    await new Promise((resolve) => window.setTimeout(resolve, 60));
    expect(slot.style.transform).toBe(scrubbedTransform);

    fireEvent.keyDown(screen.getByLabelText('Include image slots'), { code: 'Space', key: ' ' });
    expect(screen.getByTestId('gallery-carousel-pause-indicator')).toBeTruthy();

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    await waitFor(() => expect(screen.queryByTestId('gallery-carousel-pause-indicator')).toBeNull());
  });

  it('fills the fullscreen viewport and lets users hide and reveal carousel controls', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [
          {
            id: 'video-1',
            workspaceId: 'ws-1',
            type: 'video',
            originalUrl: '/video-1.mp4',
            previewUrl: '/video-1.mp4',
            thumbnailUrl: '/video-1.png',
            mediaWidth: 720,
            mediaHeight: 1280,
            addedToGalleryAt: '2026-07-21T06:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 100, totalCount: 1, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('1 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    const controls = screen.getByTestId('gallery-carousel-controls');
    expect(stage.className).toContain('h-full');
    expect(stage.className).toContain('min-h-[100dvh]');

    fireEvent.click(screen.getByRole('button', { name: 'Hide carousel controls' }));
    expect(controls.className).toContain('opacity-0');
    expect(screen.queryByText('1 videos')).toBeNull();

    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 200 });
    await waitFor(() => expect(controls.className).toContain('opacity-100'));

    fireEvent.keyDown(window, { key: 'h' });
    expect(controls.className).toContain('opacity-0');

    fireEvent.keyDown(window, { key: 'H' });
    expect(controls.className).toContain('opacity-100');
  });

  it('restores played clips when scrubbing backward after they leave the forward edge', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        assets: [1, 2, 3].map((index) => ({
          id: `video-${index}`,
          workspaceId: 'ws-1',
          type: 'video',
          originalUrl: `/video-${index}.mp4`,
          previewUrl: `/video-${index}.mp4`,
          thumbnailUrl: `/video-${index}.png`,
          mediaWidth: 720,
          mediaHeight: 1280,
          addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
        })),
        pagination: { page: 1, limit: 100, totalCount: 3, hasNextPage: false },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('3 videos')).toBeTruthy());

    const stage = screen.getByTestId('gallery-video-carousel');
    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());

    fireEvent.pointerDown(stage, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0 });
    fireEvent.pointerMove(stage, { pointerId: 1, pointerType: 'mouse', clientX: 5000 });
    fireEvent.pointerUp(stage, { pointerId: 1, pointerType: 'mouse', clientX: 5000 });

    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeNull());

    fireEvent.pointerDown(stage, { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 5000 });
    fireEvent.pointerMove(stage, { pointerId: 2, pointerType: 'mouse', clientX: 1000 });
    fireEvent.pointerUp(stage, { pointerId: 2, pointerType: 'mouse', clientX: 1000 });

    await waitFor(() => expect(stage.querySelector('video[src="/video-1.mp4"]')).toBeTruthy());
    expect(stage.querySelector('video[src="/video-2.mp4"]')).toBeTruthy();
  });

  it('loads images and rebuilds the feed when Images is toggled', async () => {
    const videoAssets = [
      {
        id: 'video-1',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-1.mp4',
        previewUrl: '/video-1.mp4',
        thumbnailUrl: '/video-1.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:00:00Z',
      },
      {
        id: 'video-2',
        workspaceId: 'ws-1',
        type: 'video',
        originalUrl: '/video-2.mp4',
        previewUrl: '/video-2.mp4',
        thumbnailUrl: '/video-2.png',
        mediaWidth: 720,
        mediaHeight: 1280,
        addedToGalleryAt: '2026-07-21T06:01:00Z',
      },
    ];
    const imageAssets = Array.from({ length: 5 }, (_, index) => ({
      id: `image-${index + 1}`,
      workspaceId: 'ws-1',
      type: 'image',
      originalUrl: `/image-${index + 1}.png`,
      previewUrl: `/image-${index + 1}.png`,
      thumbnailUrl: null,
      prompt: `Image ${index + 1}`,
      mediaWidth: 720,
      mediaHeight: 1280,
      addedToGalleryAt: `2026-07-21T06:0${index}:00Z`,
    }));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const search = new URLSearchParams(url.split('?')[1] || '');
      const type = search.get('type');
      const assets = type === 'image' ? imageAssets : videoAssets;
      return {
        ok: true,
        json: async () => ({
          success: true,
          assets,
          pagination: { page: 1, limit: 100, totalCount: assets.length, hasNextPage: false },
        }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(GalleryVideoCarousel, { workspaceId: 'ws-1' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain('type=video');
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(false);
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('type=image'))).toBe(true);
    await waitFor(() => expect(screen.getByText('2 videos · 5 images')).toBeTruthy());
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByLabelText('Include image slots'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(screen.getByText('2 videos')).toBeTruthy());
    expect((screen.getByLabelText('Include image slots') as HTMLInputElement).checked).toBe(false);
  });
});
