/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MobileGalleryDetailsScreen from '@/components/mobile/gallery/MobileGalleryDetailsScreen';
import type { MobileGalleryDetail } from '@/hooks/gallery/useMobileGalleryDetails';

const mockAsset: MobileGalleryDetail = {
  id: 'asset-1',
  workspaceId: 'ws-1',
  type: 'image',
  originalUrl: '/image.png',
  previewUrl: '/image.png',
  thumbnailUrl: null,
  favorited: false,
  trashed: false,
  userTags: [],
  autoTags: [],
  sourceJobId: null,
  sourceOutputId: null,
  prompt: 'image prompt',
  promptTemplate: null,
  resolvedPrompt: null,
  sourceImagePrompt: null,
  sourceImageResolvedPrompt: null,
  seed: 42,
  modelId: 'z-image',
  addedToGalleryAt: '2026-07-31T22:53:30Z',
};

let currentAsset: MobileGalleryDetail | null = mockAsset;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/hooks/gallery/useMobileGalleryDetails', () => ({
  useMobileGalleryDetails: () => ({
    asset: currentAsset,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    setAsset: vi.fn(),
  }),
}));

describe('MobileGalleryDetailsScreen share action', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    currentAsset = mockAsset;
  });

  it('does not show Share for image assets because sharing belongs to the viewer', () => {
    render(React.createElement(MobileGalleryDetailsScreen, { assetId: 'asset-1' }));

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Favorite' })).toBeTruthy();
  });

  it('does not show Share for audio assets', () => {
    currentAsset = {
      ...mockAsset,
      type: 'audio',
      originalUrl: '/audio.mp3',
      previewUrl: null,
      seed: null,
      modelId: 'tts',
    };

    render(React.createElement(MobileGalleryDetailsScreen, { assetId: 'asset-1' }));

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('uses poster-backed metadata preload for video previews', () => {
    currentAsset = {
      ...mockAsset,
      type: 'video',
      originalUrl: '/video-original.mp4',
      previewUrl: '/video-preview.mp4',
      thumbnailUrl: '/video-poster.jpg',
      seed: 42,
      modelId: 'wan22',
    };

    render(React.createElement(MobileGalleryDetailsScreen, { assetId: 'asset-1' }));

    const video = document.querySelector('video') as HTMLVideoElement | null;
    expect(video?.getAttribute('src')).toBe('/video-preview.mp4');
    expect(video?.getAttribute('poster')).toBe('/video-poster.jpg');
    expect(video?.getAttribute('preload')).toBe('metadata');
  });

  it('copies the selected prompt from mobile details', async () => {
    currentAsset = {
      ...mockAsset,
      type: 'video',
      prompt: 'video prompt',
      resolvedPrompt: 'resolved video prompt',
      sourceImagePrompt: 'source image prompt',
      sourceImageResolvedPrompt: 'resolved source prompt',
      modelId: 'wan22',
    };

    render(React.createElement(MobileGalleryDetailsScreen, { assetId: 'asset-1' }));

    fireEvent.click(screen.getByRole('button', { name: 'Resolved source' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy selected prompt' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('resolved source prompt');
    });
  });
});
