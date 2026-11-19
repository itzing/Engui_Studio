/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ workspaceId: 'helper-a' }));

const { mockAddJob, mockSubmitImageGeneration } = vi.hoisted(() => ({
  mockAddJob: vi.fn(),
  mockSubmitImageGeneration: vi.fn(async (params: any) => ({
    success: true,
    job: {
      id: 'job-1',
      modelId: 'mock-image',
      type: 'image',
      status: 'queued',
      prompt: params.prompt,
      createdAt: Date.now(),
      options: {},
    },
    nextSeed: null,
  })),
}));

vi.mock('@/lib/workspaces/useWorkspaceFetch', () => {
  const scopedFetch = (input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init);
  return { useWorkspaceFetch: () => scopedFetch };
});

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    settings: {
      promptHelper: { provider: 'local', local: { baseUrl: 'http://fixture.invalid', model: 'fixture' } },
      visionPromptHelper: { provider: 'disabled', local: {} },
      apiKeys: {},
      runpod: { endpoints: {} },
    },
    addJob: mockAddJob,
    activeWorkspaceId: fixture.workspaceId,
  }),
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockModel = {
  id: 'mock-image',
  name: 'Mock Image',
  provider: 'test',
  type: 'image',
  inputs: ['text'],
  optionalInputs: [],
  parameters: [
    { name: 'width', label: 'Width', type: 'number', default: 1024, min: 512, max: 2048, step: 64, group: 'basic' },
    { name: 'height', label: 'Height', type: 'number', default: 1024, min: 512, max: 2048, step: 64, group: 'basic' },
  ],
  capabilities: {},
  api: { type: 'runpod', endpoint: 'endpoint-1' },
};

vi.mock('@/lib/models/modelConfig', () => ({
  getModelsByType: () => [mockModel],
  getModelById: (id: string) => (id === 'mock-image' ? mockModel : null),
  isInputVisible: (model: typeof mockModel, input: string) => model.inputs.includes(input),
}));

vi.mock('@/lib/create/submitImageGeneration', () => ({
  submitImageGeneration: mockSubmitImageGeneration,
}));

vi.mock('@/hooks/create/useImageCreateDraftPersistence', () => ({
  useImageCreateDraftPersistence: () => ({
    switchModel: vi.fn(),
    hasRestoredDraftRef: { current: true },
  }),
}));

vi.mock('@/components/lora/LoRASelector', () => ({
  LoRASelector: () => null,
}));

vi.mock('@/components/lora/LoRAManagementDialog', () => ({
  LoRAManagementDialog: () => null,
}));

vi.mock('@/lib/create/imagePromptHelper', () => ({
  requestImagePromptImprovement: vi.fn(),
  extractImagePromptFromDataUrl: vi.fn(),
}));

import ImageGenerationForm from '@/components/forms/ImageGenerationForm';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}


import { chooseBrowserWorkspace, workspaceStorageKey } from '@/lib/workspaces/client';

const storageKey = (id = fixture.workspaceId) => workspaceStorageKey('engui:prompt-helper:instruction', id);
const original = '  Preserve details.\nUse natural light.  ';
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Prompt Helper' }));
const instruction = () => screen.getByLabelText('Instruction', { exact: true }) as HTMLTextAreaElement;

beforeEach(() => {
  vi.clearAllMocks();
  fixture.workspaceId = 'helper-a';
  window.localStorage.clear();
  window.sessionStorage.clear();
  chooseBrowserWorkspace(fixture.workspaceId);
  window.localStorage.setItem(storageKey(), original);
  Object.defineProperty(window, 'matchMedia', { writable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) });
  vi.stubGlobal('fetch', vi.fn(() => jsonResponse({ success: true, vibes: [], documents: [], wildcards: [] })));
});
afterEach(async () => { await act(async () => {}); cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('desktop image Prompt Helper persistence', () => {
  it('restores without any write or deletion, including StrictMode effect replay', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    render(React.createElement(React.StrictMode, null, React.createElement(ImageGenerationForm)));
    open(); expect(instruction().value).toBe(original);
    expect(write.mock.calls.filter(([key]) => key === storageKey())).toEqual([]);
    expect(remove.mock.calls.filter(([key]) => key === storageKey())).toEqual([]);
  });

  it('preserves the instruction when restoring another mode unmounts Image during initial effects', () => {
    function RestoredVideoMode() {
      const [mode, setMode] = React.useState('image');
      React.useEffect(() => setMode('video'), []);
      return mode === 'image' ? React.createElement(ImageGenerationForm) : React.createElement('p', null, 'Video restored');
    }
    render(React.createElement(RestoredVideoMode));
    expect(screen.getByText('Video restored')).toBeTruthy();
    expect(window.localStorage.getItem(storageKey())).toBe(original);
  });

  it('persists edited text immediately and restores it after a form remount', () => {
    const view = render(React.createElement(ImageGenerationForm)); open();
    const edited = '  Edited instruction\nwith exact whitespace  ';
    fireEvent.change(instruction(), { target: { value: edited } });
    expect(window.localStorage.getItem(storageKey())).toBe(edited);
    view.unmount(); render(React.createElement(ImageGenerationForm)); open();
    expect(instruction().value).toBe(edited);
  });

  it('retains intentional clearing after remount', () => {
    const view = render(React.createElement(ImageGenerationForm)); open();
    fireEvent.change(instruction(), { target: { value: '' } });
    expect(window.localStorage.getItem(storageKey())).toBeNull();
    view.unmount(); render(React.createElement(ImageGenerationForm)); open();
    expect(instruction().value).toBe('');
  });

  it('keeps workspace instructions separate, including a workspace without a saved value', () => {
    const a = storageKey('helper-a'); const b = storageKey('helper-b');
    const view = render(React.createElement(ImageGenerationForm)); open();
    fixture.workspaceId = 'helper-b'; chooseBrowserWorkspace(fixture.workspaceId);
    view.rerender(React.createElement(ImageGenerationForm));
    expect(instruction().value).toBe('');
    fireEvent.change(instruction(), { target: { value: 'Only workspace B' } });
    expect(window.localStorage.getItem(a)).toBe(original);
    expect(window.localStorage.getItem(b)).toBe('Only workspace B');
    fixture.workspaceId = 'helper-a'; chooseBrowserWorkspace(fixture.workspaceId);
    view.rerender(React.createElement(ImageGenerationForm));
    expect(instruction().value).toBe(original);
  });

  it('does not delete the saved value when reading browser storage fails', () => {
    const read = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key: string) {
      if (key === storageKey()) throw new DOMException('Storage unavailable', 'SecurityError');
      return read.call(this, key);
    });
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(React.createElement(ImageGenerationForm));
    expect(remove.mock.calls.filter(([key]) => key === storageKey())).toEqual([]);
    expect(read.call(window.localStorage, storageKey())).toBe(original);
  });
});
