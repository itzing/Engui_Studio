/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn(async () => undefined));
const mockEnsureRangeLoaded = vi.hoisted(() => vi.fn(async () => undefined));
const mockRemoveJob = vi.hoisted(() => vi.fn(async () => undefined));
const mockCancelActiveJob = vi.hoisted(() => vi.fn(async () => undefined));
const mockUpscaleJob = vi.hoisted(() => vi.fn(async () => undefined));
const mockSubmit = vi.hoisted(() => vi.fn(async () => true));
const mockSelectModel = vi.hoisted(() => vi.fn(async () => undefined));

const mockJobsState = vi.hoisted(() => ({
  current: null as unknown,
}));

const mockCreateState = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@/components/mobile/create/MobileCreateProvider', () => ({
  useMobileCreate: () => mockCreateState.current,
}));

vi.mock('@/hooks/jobs/useMobileJobsScreen', () => ({
  useMobileJobsScreen: () => mockJobsState.current,
}));

vi.mock('@/components/mobile/create/MobileCreateModeBar', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mode-bar' }, 'mode-bar'),
}));

vi.mock('@/components/forms/VideoGenerationForm', () => ({
  default: () => React.createElement('div', null, 'video-form'),
}));

vi.mock('@/components/forms/AudioGenerationForm', () => ({
  default: () => React.createElement('div', null, 'audio-form'),
}));

vi.mock('@/components/forms/MusicGenerationForm', () => ({
  default: () => React.createElement('div', null, 'music-form'),
}));

import TabletCreateWorkspace from '@/components/mobile/tablet/TabletCreateWorkspace';

function buildCreateState(overrides: Record<string, unknown> = {}) {
  return {
    imageModels: [{ id: 'z-image', name: 'Z-Image' }],
    selectedModel: 'z-image',
    currentModel: {
      id: 'z-image',
      name: 'Z-Image',
      parameters: [
        { name: 'seed', label: 'Seed', default: 123 },
        { name: 'width', label: 'Width', default: 1024 },
        { name: 'height', label: 'Height', default: 1536 },
      ],
    },
    prompt: 'A tablet test prompt',
    setPrompt: vi.fn(),
    previewUrl: '',
    previewUrl2: '',
    primaryImageVisible: false,
    secondaryImageVisible: false,
    primaryImageRequired: false,
    secondaryImageRequired: false,
    selectPrimaryImageFile: vi.fn(),
    selectSecondaryImageFile: vi.fn(),
    clearPrimaryImage: vi.fn(),
    clearSecondaryImage: vi.fn(),
    randomizeSeed: true,
    setRandomizeSeed: vi.fn(),
    handleParameterChange: vi.fn(),
    handleNumericParameterInput: vi.fn(),
    parameterValues: { seed: 123, width: 1024, height: 1536 },
    basicParameters: [],
    promptDocuments: [],
    isPromptDocumentsLoading: false,
    isPromptDraftSyncing: false,
    selectedPromptDocumentId: '',
    selectedPromptDocumentTitle: '',
    isPromptDraftSelected: false,
    selectPromptDocument: vi.fn(),
    clearPromptDocument: vi.fn(),
    isGenerating: false,
    submit: mockSubmit,
    message: null,
    setMessage: vi.fn(),
    isLoadingMedia: false,
    selectModel: mockSelectModel,
    promptHelperInstruction: '',
    setPromptHelperInstruction: vi.fn(),
    isPromptHelperConfigured: false,
    promptHelperError: null,
    isPromptHelperLoading: false,
    runSavedPromptHelperInstruction: vi.fn(),
    ...overrides,
  };
}

function buildJobsState(overrides: Record<string, unknown> = {}) {
  const imageJob = {
    id: 'job-1',
    modelId: 'z-image',
    type: 'image',
    status: 'completed',
    prompt: 'First job prompt',
    createdAt: 1000,
    resultUrl: '/result.png',
    thumbnailUrl: '/thumb.png',
  };
  const videoJob = {
    id: 'job-2',
    modelId: 'wan22',
    type: 'video',
    status: 'completed',
    prompt: 'Second job prompt',
    createdAt: 2000,
    resultUrl: '/video.mp4',
    thumbnailUrl: '/video-thumb.jpg',
  };

  return {
    totalCount: 2,
    loadedEntries: [
      { job: imageJob, absoluteIndex: 0 },
      { job: videoJob, absoluteIndex: 1 },
    ],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    refresh: mockRefresh,
    ensureRangeLoaded: mockEnsureRangeLoaded,
    removeJob: mockRemoveJob,
    cancelActiveJob: mockCancelActiveJob,
    upscaleJob: mockUpscaleJob,
    ...overrides,
  };
}

describe('TabletCreateWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    HTMLElement.prototype.setPointerCapture = vi.fn();
    mockCreateState.current = buildCreateState();
    mockJobsState.current = buildJobsState();
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.includes('/api/jobs/job-1')) {
        return new Response(JSON.stringify({
          success: true,
          job: {
            id: 'job-1',
            modelId: 'z-image',
            type: 'image',
            status: 'completed',
            prompt: 'First job prompt',
            createdAt: 1000,
            executionMs: 2500,
            outputs: [{
              outputId: 'output-1',
              type: 'image',
              url: '/result.png',
              previewUrl: '/result-preview.png',
              thumbnailUrl: '/thumb.png',
              savedBuckets: [],
              galleryAssetId: null,
              galleryAssetIdsByBucket: {},
            }],
          },
        }));
      }
      if (path.includes('/api/jobs/job-2')) {
        return new Response(JSON.stringify({
          success: true,
          job: {
            id: 'job-2',
            modelId: 'wan22',
            type: 'video',
            status: 'completed',
            prompt: 'Second job prompt',
            createdAt: 2000,
            outputs: [{
              outputId: 'output-1',
              type: 'video',
              url: '/video.mp4',
              previewUrl: null,
              thumbnailUrl: '/video-thumb.jpg',
              savedBuckets: [],
              galleryAssetId: null,
              galleryAssetIdsByBucket: {},
            }],
          },
        }));
      }
      return new Response(JSON.stringify({ success: true }));
    }) as typeof fetch;
  });

  it('renders left Create controls, right preview, and create-level Gallery/Carousel entries', async () => {
    render(React.createElement(TabletCreateWorkspace, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    expect(screen.getByTestId('tablet-create-workspace')).toBeTruthy();
    expect(screen.getByTestId('mode-bar')).toBeTruthy();
    expect(screen.getByTestId('tablet-create-prompt-textarea')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Gallery' }).getAttribute('href')).toBe('/m/gallery');
    expect(screen.getByRole('link', { name: 'Open Carousel' }).getAttribute('href')).toBe('/m/carousel');

    await waitFor(() => expect(screen.getByAltText('First job prompt')).toBeTruthy());
  });

  it('shows contained strip thumbnails and a play icon for video jobs', () => {
    render(React.createElement(TabletCreateWorkspace, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    const imageThumb = screen.getByAltText('z-image');
    const videoThumb = screen.getByAltText('wan22');

    expect(imageThumb.className).toContain('object-contain');
    expect(videoThumb.className).toContain('object-contain');
    expect(screen.getByRole('button', { name: 'Preview wan22' }).querySelector('svg')).toBeTruthy();
  });

  it('resizes the jobs strip by dragging the top edge with a one-third viewport cap', () => {
    render(React.createElement(TabletCreateWorkspace, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    const strip = screen.getByTestId('tablet-jobs-strip');
    const handle = screen.getByRole('separator', { name: 'Resize jobs strip' });
    expect(strip.getAttribute('style')).toContain('height: 168px');

    fireEvent.pointerDown(handle, { pointerId: 5, clientY: 700 });
    fireEvent.pointerMove(handle, { pointerId: 5, clientY: 100 });

    expect(strip.getAttribute('style')).toContain('height: 256px');
  });
});
