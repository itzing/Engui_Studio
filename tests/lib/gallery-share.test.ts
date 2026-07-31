/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shareGalleryAsset } from '@/lib/galleryShare';

describe('shareGalleryAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shares image assets as files when native file share is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
    }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });

    await expect(shareGalleryAsset({
      id: 'asset-1',
      type: 'image',
      originalUrl: '/media/asset-1.png',
      title: 'Gallery image',
    })).resolves.toBe('file');

    expect(canShare).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
  });

  it('falls back to URL share when file share is unavailable', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(false);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['video-bytes'], { type: 'video/mp4' }),
    }));
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: canShare });

    await expect(shareGalleryAsset({
      id: 'asset-2',
      type: 'video',
      originalUrl: '/media/asset-2.mp4',
    })).resolves.toBe('url');

    expect(share).toHaveBeenLastCalledWith(expect.objectContaining({ url: '/media/asset-2.mp4' }));
  });

  it('copies the URL when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    await expect(shareGalleryAsset({
      id: 'asset-3',
      type: 'image',
      originalUrl: '/media/asset-3.png',
    })).resolves.toBe('copied');

    expect(writeText).toHaveBeenCalledWith('/media/asset-3.png');
  });
});
