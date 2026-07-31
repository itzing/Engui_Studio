/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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
    currentAsset = mockAsset;
  });

  it('shows Share for image assets beside the detail actions', () => {
    render(React.createElement(MobileGalleryDetailsScreen, { assetId: 'asset-1' }));

    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
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
});
