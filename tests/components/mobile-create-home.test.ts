/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectPromptDocument, mockClearPromptDocument, mockSubmitBatch } = vi.hoisted(() => ({
  mockSelectPromptDocument: vi.fn(),
  mockClearPromptDocument: vi.fn(),
  mockSubmitBatch: vi.fn(async () => true),
}));

const mobileCreateState = vi.hoisted(() => ({ current: null as any }));

vi.mock('@/components/mobile/create/MobileCreateProvider', () => ({
  useMobileCreate: () => mobileCreateState.current,
}));

vi.mock('@/components/mobile/MobileScreen', () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

vi.mock('@/components/mobile/create/MobileCreateModeBar', () => ({
  default: () => React.createElement('div', null, 'mode-bar'),
}));

vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

import MobileCreateHome from '@/components/mobile/create/MobileCreateHome';

function buildState(overrides: Record<string, any> = {}) {
  return {
    currentModel: {
      id: 'mock-image',
      name: 'Z-Image',
      parameters: [
        { name: 'seed', default: 1920494315 },
        { name: 'width', default: 1024 },
        { name: 'height', default: 1536 },
      ],
    },
    prompt: 'A cinematic portrait prompt',
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
    controlNetEnabled: false,
    supportsControlNet: true,
    parameterValues: { seed: 1920494315, width: 1024, height: 1536 },
    promptDocuments: [
      {
        id: 'draft-1',
        title: 'Scene Draft',
        templateId: 'scene_template_v2',
        sceneType: 'portrait scene',
      },
    ],
    isPromptDocumentsLoading: false,
    isPromptDraftSyncing: false,
    selectedPromptDocumentId: '',
    selectedPromptDocumentTitle: '',
    isPromptDraftSelected: false,
    selectPromptDocument: mockSelectPromptDocument,
    clearPromptDocument: mockClearPromptDocument,
    isGenerating: false,
    batchProgress: null,
    submit: vi.fn(),
    submitBatch: mockSubmitBatch,
    message: null,
    setMessage: vi.fn(),
    isLoadingMedia: false,
    ...overrides,
  };
}

describe('MobileCreateHome prompt draft tile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an unselected prompt draft tile and opens the selector dialog', () => {
    mobileCreateState.current = buildState();

    render(React.createElement(MobileCreateHome, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    expect(screen.getByTestId('mobile-prompt-draft-title').textContent).toBe('Not selected');
    expect(screen.getByText(/Prompt:/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /open prompt editor/i })).toBeTruthy();

    fireEvent.click(screen.getByTestId('mobile-prompt-draft-tile'));

    expect(screen.getByText('Select Prompt Draft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /scene draft/i }));
    expect(mockSelectPromptDocument).toHaveBeenCalledWith('draft-1');
  });

  it('shows the selected draft title and hides prompt controls', () => {
    mobileCreateState.current = buildState({
      selectedPromptDocumentId: 'draft-1',
      selectedPromptDocumentTitle: 'Scene Draft',
      isPromptDraftSelected: true,
    });

    render(React.createElement(MobileCreateHome, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    expect(screen.getByTestId('mobile-prompt-draft-title').textContent).toBe('Scene Draft');
    expect(screen.queryByText(/Prompt:/i)).toBeNull();
    expect(screen.queryByRole('link', { name: /open prompt editor/i })).toBeNull();
  });

  it('opens and closes the primary reference preview fullscreen', () => {
    mobileCreateState.current = buildState({
      previewUrl: '/reference.png',
      primaryImageVisible: true,
      primaryImageRequired: false,
    });

    render(React.createElement(MobileCreateHome, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    fireEvent.click(screen.getByRole('button', { name: 'Open primary input preview fullscreen' }));

    const fullscreen = screen.getByTestId('mobile-create-reference-fullscreen');
    expect(fullscreen).toBeTruthy();
    expect((screen.getByAltText('Reference fullscreen') as HTMLImageElement).getAttribute('src')).toBe('/reference.png');

    fireEvent.click(fullscreen);

    expect(screen.queryByTestId('mobile-create-reference-fullscreen')).toBeNull();
  });

  it('shows equal batch generate actions and submits the selected count', () => {
    mobileCreateState.current = buildState();

    render(React.createElement(MobileCreateHome, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    const gen1 = screen.getByRole('button', { name: /gen 1/i });
    const gen3 = screen.getByRole('button', { name: /gen 3/i });
    const gen6 = screen.getByRole('button', { name: /gen 6/i });

    expect(gen1).toBeTruthy();
    expect(gen3).toBeTruthy();
    expect(gen6).toBeTruthy();

    fireEvent.click(gen3);

    expect(mockSubmitBatch).toHaveBeenCalledWith(3);
  });

  it('shows active batch progress while generation is starting', () => {
    mobileCreateState.current = buildState({
      isGenerating: true,
      batchProgress: { total: 6, started: 2 },
    });

    render(React.createElement(MobileCreateHome, {
      activeMode: 'image',
      onModeChange: vi.fn(),
    }));

    expect(screen.getByRole('button', { name: /2\/6/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /gen 1/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /gen 3/i })).toHaveProperty('disabled', true);
  });
});
