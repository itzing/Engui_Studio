/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSelectPromptDocument, mockClearPromptDocument, mockSubmitBatch, mockToast } = vi.hoisted(() => ({
  mockSelectPromptDocument: vi.fn(),
  mockClearPromptDocument: vi.fn(),
  mockSubmitBatch: vi.fn(async () => true),
  mockToast: vi.fn(),
}));

const mobileCreateState = vi.hoisted(() => ({ current: null as any, workspaceId: 'fixture' }));

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
  useToast: () => ({ showToast: mockToast }),
}));

vi.mock('@/lib/context/StudioContext', () => ({ useStudio: () => ({ activeWorkspaceId: mobileCreateState.workspaceId }) }));

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


const pastePrompt = () => screen.getByRole('button', { name: 'Paste and replace prompt' });
const clipboard = (readText?: () => Promise<string>) => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: readText ? { readText } : undefined });
const home = (mode: 'image' | 'video' = 'image') => React.createElement(MobileCreateHome, { activeMode: mode, onModeChange: vi.fn() });

describe('MobileCreateHome prompt-card paste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mobileCreateState.workspaceId = 'fixture';
    mobileCreateState.current = buildState();
  });
  afterEach(() => { cleanup(); clipboard(); vi.restoreAllMocks(); });

  it('reads on tap and replaces exact text without opening the editor or generating', async () => {
    const text = '  New home prompt\nSecond line {wildcard}  ';
    const read = vi.fn().mockResolvedValue(text); clipboard(read); render(home());
    const link = screen.getByRole('link', { name: 'Open prompt editor' });
    const openEditor = vi.fn(); link.addEventListener('click', openEditor);
    expect(pastePrompt().closest('a')).toBeNull();
    expect(read).not.toHaveBeenCalled();
    fireEvent.click(pastePrompt());
    await waitFor(() => expect(mobileCreateState.current.setPrompt).toHaveBeenCalledExactlyOnceWith(text));
    expect(openEditor).not.toHaveBeenCalled();
    expect(mockSubmitBatch).not.toHaveBeenCalled();
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA');
  });
  it('pastes into an empty prompt', async () => {
    mobileCreateState.current = buildState({ prompt: '' });
    clipboard(vi.fn().mockResolvedValue('First prompt')); render(home()); fireEvent.click(pastePrompt());
    await waitFor(() => expect(mobileCreateState.current.setPrompt).toHaveBeenCalledExactlyOnceWith('First prompt'));
  });
  it('preserves the prompt when clipboard has no text', async () => {
    clipboard(vi.fn().mockResolvedValue('')); render(home()); fireEvent.click(pastePrompt());
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Clipboard has no text. Prompt unchanged.', 'info', 3000));
    expect(mobileCreateState.current.setPrompt).not.toHaveBeenCalled();
  });
  it('preserves the prompt and points to the editor when permission is denied', async () => {
    clipboard(vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'))); render(home()); fireEvent.click(pastePrompt());
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith('Cannot read clipboard. Open the prompt editor to paste manually.', 'error'));
    expect(mobileCreateState.current.setPrompt).not.toHaveBeenCalled();
    expect((pastePrompt() as HTMLButtonElement).disabled).toBe(false);
  });
  it('preserves the prompt when the clipboard API is unavailable', () => {
    clipboard(); render(home()); fireEvent.click(pastePrompt());
    expect(mockToast).toHaveBeenCalledWith('Clipboard access is unavailable. Open the prompt editor to paste manually.', 'info');
    expect(mobileCreateState.current.setPrompt).not.toHaveBeenCalled();
  });
  it('deduplicates a pending read and ignores its result after opening the editor', async () => {
    let resolve!: (value: string) => void;
    const read = vi.fn(() => new Promise<string>(done => { resolve = done; })); clipboard(read); render(home());
    fireEvent.click(pastePrompt()); fireEvent.click(pastePrompt());
    expect(read).toHaveBeenCalledTimes(1); expect((pastePrompt() as HTMLButtonElement).disabled).toBe(true);
    const link = screen.getByRole('link', { name: 'Open prompt editor' });
    link.addEventListener('click', event => event.preventDefault()); fireEvent.click(link);
    await act(async () => resolve('Late replacement'));
    expect(mobileCreateState.current.setPrompt).not.toHaveBeenCalled();
  });
  it.each(['workspace', 'model', 'draft', 'mode', 'unmount'])('ignores a pending result after %s changes', async change => {
    let resolve!: (value: string) => void;
    clipboard(() => new Promise<string>(done => { resolve = done; })); const view = render(home());
    fireEvent.click(pastePrompt());
    const setPrompt = mobileCreateState.current.setPrompt;
    if (change === 'workspace') mobileCreateState.workspaceId = 'different';
    if (change === 'model') mobileCreateState.current.currentModel = { ...mobileCreateState.current.currentModel, id: 'different' };
    if (change === 'draft') mobileCreateState.current.isPromptDraftSelected = true;
    if (change === 'unmount') view.unmount();
    else view.rerender(home(change === 'mode' ? 'video' : 'image'));
    await act(async () => resolve('Late replacement'));
    expect(setPrompt).not.toHaveBeenCalled(); expect(mockToast).not.toHaveBeenCalled();
  });
  it('hides paste when a constructor draft is selected', () => {
    mobileCreateState.current.isPromptDraftSelected = true;
    const read = vi.fn(); clipboard(read); render(home());
    expect(screen.queryByRole('button', { name: 'Paste and replace prompt' })).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
