/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectPromptDocument, mockClearPromptDocument, mockSubmit } = vi.hoisted(() => ({
  mockSelectPromptDocument: vi.fn(),
  mockClearPromptDocument: vi.fn(),
  mockSubmit: vi.fn(async () => true),
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
    promptSummary: 'A cinematic portrait prompt',
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
    submit: mockSubmit,
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
    expect(screen.getByText('Prompt editor')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open focused prompt editor/i })).toBeTruthy();

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
    expect(screen.queryByText('Prompt editor')).toBeNull();
    expect(screen.queryByRole('link', { name: /open focused prompt editor/i })).toBeNull();
  });
});
