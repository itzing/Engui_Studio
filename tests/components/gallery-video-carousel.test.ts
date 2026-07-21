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

  it('loads all videos and toggles pause on scene click', async () => {
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
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });
});
