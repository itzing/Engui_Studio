/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATE_DRAFT_STATE_STORAGE_KEY } from '@/lib/create/createDraftSchema';

const { mockAddJob, mockSetSelectedModel } = vi.hoisted(() => ({
  mockAddJob: vi.fn(),
  mockSetSelectedModel: vi.fn(),
}));

vi.mock('@/lib/context/StudioContext', () => ({
  useStudio: () => ({
    settings: {
      promptHelper: { provider: 'local', local: { baseUrl: 'http://prompt-helper.local', model: 'helper-model' } },
      apiKeys: {},
      runpod: { endpoints: {} },
    },
    addJob: mockAddJob,
    setSelectedModel: mockSetSelectedModel,
    activeWorkspaceId: 'ws-1',
  }),
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/components/lora/LoRAPairSelector', () => ({
  LoRAPairSelector: ({
    highWeight,
    lowWeight,
    onHighWeightChange,
    onLowWeightChange,
  }: {
    highWeight: number;
    lowWeight: number;
    onHighWeightChange: (weight: number) => void;
    onLowWeightChange: (weight: number) => void;
  }) => React.createElement(
    'div',
    null,
    React.createElement('input', {
      'aria-label': 'high-weight',
      value: highWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onHighWeightChange(Number(event.target.value)),
    }),
    React.createElement('input', {
      'aria-label': 'low-weight',
      value: lowWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onLowWeightChange(Number(event.target.value)),
    }),
  ),
}));

vi.mock('@/components/lora/LoRASelector', () => ({
  LoRASelector: () => null,
}));

vi.mock('@/components/lora/LoRAManagementDialog', () => ({
  LoRAManagementDialog: () => null,
}));

import VideoGenerationForm from '@/components/forms/VideoGenerationForm';
import { getModelById } from '@/lib/models/modelConfig';

function jsonResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: async () => body,
  } as Response);
}

function textResponse(body: string, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    text: async () => body,
  } as Response);
}

describe('VideoGenerationForm WAN22 LoRA weight persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
  });

  it('saves edited WAN22 LoRA weights into the video draft and restores them after remount', async () => {
    const firstRender = render(React.createElement(VideoGenerationForm));

    const advancedButton = await screen.findByRole('button', { name: 'generationForm.advancedSettings' });
    fireEvent.click(advancedButton);

    const highInputs = await screen.findAllByLabelText('high-weight') as HTMLInputElement[];
    const lowInputs = await screen.findAllByLabelText('low-weight') as HTMLInputElement[];
    fireEvent.change(highInputs[0], { target: { value: '1' } });
    fireEvent.change(lowInputs[0], { target: { value: '1' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts.wan22.draft.parameterValues).toMatchObject({
        lora_high_1_weight: 1,
        lora_low_1_weight: 1,
      });
    });

    firstRender.unmount();
    render(React.createElement(VideoGenerationForm));

    const restoredAdvancedButton = await screen.findByRole('button', { name: 'generationForm.advancedSettings' });
    fireEvent.click(restoredAdvancedButton);

    await waitFor(() => {
      const restoredHighInputs = screen.getAllByLabelText('high-weight') as HTMLInputElement[];
      const restoredLowInputs = screen.getAllByLabelText('low-weight') as HTMLInputElement[];
      expect(restoredHighInputs[0].value).toBe('1');
      expect(restoredLowInputs[0].value).toBe('1');
    });
  });

  it('keeps WAN22 Create Video defaults at 4 steps and 80 frames', () => {
    const model = getModelById('wan22');
    expect(model?.parameters.find((param) => param.name === 'steps')?.default).toBe(4);
    expect(model?.parameters.find((param) => param.name === 'length')?.default).toBe(80);
    expect(model?.parameters.find((param) => param.name === 'length')?.min).toBeLessThanOrEqual(80);
  });

  it('does not apply browser step or range validation to Create Video dimensions', async () => {
    const { container } = render(React.createElement(VideoGenerationForm));

    await screen.findByRole('button', { name: 'generationForm.advancedSettings' });

    const widthInput = container.querySelector('input[name="width"]') as HTMLInputElement | null;
    const heightInput = container.querySelector('input[name="height"]') as HTMLInputElement | null;

    expect(widthInput?.getAttribute('step')).toBe('any');
    expect(widthInput?.getAttribute('min')).toBeNull();
    expect(widthInput?.getAttribute('max')).toBeNull();
    expect(heightInput?.getAttribute('step')).toBe('any');
    expect(heightInput?.getAttribute('min')).toBeNull();
    expect(heightInput?.getAttribute('max')).toBeNull();
  });

  it('opens and closes the image reference preview fullscreen', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:video-reference-preview'),
    });

    const { container } = render(React.createElement(VideoGenerationForm));

    const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    fireEvent.click(await screen.findByRole('button', { name: 'Open video reference image fullscreen' }));

    const fullscreen = screen.getByTestId('video-create-reference-fullscreen');
    expect(fullscreen).toBeTruthy();
    expect((screen.getByAltText('Video reference fullscreen') as HTMLImageElement).getAttribute('src')).toBe('blob:video-reference-preview');

    fireEvent.click(fullscreen);

    await waitFor(() => {
      expect(screen.queryByTestId('video-create-reference-fullscreen')).toBeNull();
    });
  });

  it('applies WAN22 Prompt Helper plain text responses', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-helper/improve')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body).toMatchObject({
          prompt: 'small prompt',
          instruction: 'make it cinematic',
          modelId: 'wan22',
          helperProfile: 'wan22-video',
        });
        return textResponse('expanded video prompt');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByPlaceholderText('generationForm.describeYourVideo') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'small prompt' } });

    fireEvent.click(screen.getByRole('button', { name: 'Prompt Helper' }));
    fireEvent.change(screen.getByLabelText('Instruction'), { target: { value: 'make it cinematic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(promptTextarea.value).toBe('expanded video prompt');
    });
  });

  it('adds source image context before applying WAN22 Prompt Helper', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:video-reference-preview'),
    });

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/vision-prompt-helper/extract')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.modelId).toBe('wan22');
        expect(body.imageDataUrl).toContain('data:image/png;base64');
        expect(body.instruction).toContain('WAN2.2 image-to-video');
        return jsonResponse({ success: true, prompt: 'A woman in a red dress stands by a window.' });
      }
      if (url.includes('/api/prompt-helper/improve')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body).toMatchObject({
          prompt: 'make her walk forward',
          modelId: 'wan22',
          helperProfile: 'wan22-video',
        });
        expect(body.instruction).toContain('Source image context for WAN2.2 image-to-video prompting');
        expect(body.instruction).toContain('A woman in a red dress stands by a window.');
        return textResponse('A woman in a red dress walks forward from the window, natural motion, steady camera.');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(React.createElement(VideoGenerationForm));

    const fileInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    const promptTextarea = await screen.findByPlaceholderText('generationForm.describeYourVideo') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'make her walk forward' } });

    fireEvent.click(screen.getByRole('button', { name: 'Prompt Helper' }));
    fireEvent.change(screen.getByLabelText('Instruction'), { target: { value: 'make it cinematic' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(promptTextarea.value).toBe('A woman in a red dress walks forward from the window, natural motion, steady camera.');
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/vision-prompt-helper/extract', expect.anything());
  });
});
