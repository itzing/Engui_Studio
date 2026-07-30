/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GalleryAssetDialog, type GalleryAssetDialogAsset } from '@/components/workspace/GalleryAssetDialog';

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

function renderDialog(asset: Partial<GalleryAssetDialogAsset> = {}) {
  return render(React.createElement(GalleryAssetDialog, {
    asset: {
      id: 'asset-1',
      workspaceId: 'ws-1',
      type: 'video',
      originalUrl: '/video.mp4',
      previewUrl: '/video.mp4',
      thumbnailUrl: '/thumb.jpg',
      favorited: false,
      trashed: false,
      userTags: [],
      autoTags: [],
      sourceJobId: 'job-1',
      sourceOutputId: 'output-1',
      prompt: 'video motion prompt',
      resolvedPrompt: 'video resolved motion prompt',
      sourceImagePrompt: 'source image prompt',
      sourceImageResolvedPrompt: 'source resolved image prompt',
      seed: 777123,
      modelId: 'wan22',
      addedToGalleryAt: '2026-07-24T07:30:17Z',
      ...asset,
    },
    open: true,
    onOpenChange: vi.fn(),
    onToggleFavorite: vi.fn(),
    onTrash: vi.fn(),
    onPermanentDelete: vi.fn(),
    onSaveTags: vi.fn(),
    onRemoveAutoTag: vi.fn(),
    onTagClick: vi.fn(),
  }));
}

describe('GalleryAssetDialog source prompt toggle', () => {
  it('switches video details from video prompt to source image prompt', () => {
    renderDialog();

    expect(screen.getByText('video motion prompt')).toBeTruthy();
    expect(screen.getByText('Seed')).toBeTruthy();
    expect(screen.getByText('777123')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Video' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resolved video' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved video' }));

    expect(screen.getByText('video resolved motion prompt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Source image' }));

    expect(screen.getByText('source image prompt')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resolved source' }));

    expect(screen.getByText('source resolved image prompt')).toBeTruthy();
  });

  it('keeps image prompt controls unchanged when no source prompt exists', () => {
    renderDialog({
      type: 'image',
      originalUrl: '/image.png',
      previewUrl: '/image.png',
      prompt: 'image prompt',
      sourceImagePrompt: null,
    });

    expect(screen.queryByRole('button', { name: 'Source image' })).toBeNull();
    expect(screen.getByText('image prompt')).toBeTruthy();
  });

  it('does not show seed for audio assets', () => {
    renderDialog({
      type: 'audio',
      originalUrl: '/audio.mp3',
      previewUrl: '/audio.mp3',
      prompt: 'audio prompt',
      sourceImagePrompt: null,
      seed: 555,
    });

    expect(screen.queryByText('Seed')).toBeNull();
    expect(screen.queryByText('555')).toBeNull();
  });
});
