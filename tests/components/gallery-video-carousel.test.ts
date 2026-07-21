/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

    expect(screen.getAllByText('Paused').length).toBeGreaterThan(0);
    expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
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
