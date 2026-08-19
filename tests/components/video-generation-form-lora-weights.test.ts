/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CREATE_DRAFT_STATE_STORAGE_KEY } from '@/lib/create/createDraftSchema';

const { mockAddJob, mockSetSelectedModel, mockVirtualRows } = vi.hoisted(() => ({
  mockAddJob: vi.fn(),
  mockSetSelectedModel: vi.fn(),
  mockVirtualRows: vi.fn(),
}));

const { mockLoadFileFromPath } = vi.hoisted(() => ({
  mockLoadFileFromPath: vi.fn(),
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
    highWeight: number | string;
    lowWeight: number | string;
    onHighWeightChange: (weight: string) => void;
    onLowWeightChange: (weight: string) => void;
  }) => React.createElement(
    'div',
    null,
    React.createElement('input', {
      'aria-label': 'high-weight',
      value: highWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onHighWeightChange(event.target.value),
    }),
    React.createElement('input', {
      'aria-label': 'low-weight',
      value: lowWeight,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onLowWeightChange(event.target.value),
    }),
  ),
}));

vi.mock('@/components/lora/LoRASelector', () => ({
  LoRASelector: () => null,
}));

vi.mock('@/components/lora/LoRAManagementDialog', () => ({
  LoRAManagementDialog: () => null,
}));

vi.mock('@/lib/fileUtils', () => ({
  loadFileFromPath: mockLoadFileFromPath,
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () => mockVirtualRows(),
    getTotalSize: () => options.count * options.estimateSize(),
    scrollToIndex: vi.fn(),
    measure: vi.fn(),
  }),
}));

import VideoGenerationForm from '@/components/forms/VideoGenerationForm';
import { saveWorkflowDraft, setWorkflowActiveModel } from '@/lib/createDrafts';
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

function blobResponse(body: Blob, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    blob: async () => body,
  } as Response);
}

describe('VideoGenerationForm WAN22 LoRA weight persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    mockLoadFileFromPath.mockResolvedValue(null);
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
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));
    mockVirtualRows.mockReturnValue([{ index: 0, key: 'row-0', start: 0, size: 116 }]);
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
        lora_high_1_weight: '1',
        lora_low_1_weight: '1',
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

  it('saves the WAN22 random seed setting into the video draft and restores it after remount', async () => {
    const firstRender = render(React.createElement(VideoGenerationForm));

    const randomSeedCheckbox = await screen.findByLabelText('Random seed') as HTMLInputElement;
    expect(randomSeedCheckbox.checked).toBe(false);

    fireEvent.click(randomSeedCheckbox);
    expect(randomSeedCheckbox.checked).toBe(true);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts.wan22.draft.randomizeSeed).toBe(true);
    });

    firstRender.unmount();
    render(React.createElement(VideoGenerationForm));

    await waitFor(() => {
      expect((screen.getByLabelText('Random seed') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('submits randomizeSeed and reflects the returned WAN22 I2V seed when enabled', async () => {
    let generateFormData: FormData | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url === '/api/generate') {
        generateFormData = init?.body as FormData;
        return jsonResponse({
          success: true,
          jobId: 'job-1',
          prompt: 'animate {a|b}',
          resolvedPrompt: 'animate b',
          seed: 98765,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'animate {a|b}' } });
    fireEvent.click(screen.getByLabelText('Random seed'));

    const imageInput = screen.getByLabelText('Upload reference image') as HTMLInputElement;
    const image = new File(['image'], 'source.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [image] } });
    expect((screen.getByLabelText('Random seed') as HTMLInputElement).checked).toBe(true);

    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(generateFormData?.get('modelId')).toBe('wan22');
      expect(generateFormData?.get('randomizeSeed')).toBe('true');
      expect(generateFormData?.get('prompt')).toBe('animate {a|b}');
    });

    await waitFor(() => {
      const seedInput = container.querySelector('input[name="seed"]') as HTMLInputElement | null;
      expect(seedInput?.value).toBe('98765');
    });
    expect(mockAddJob).toHaveBeenCalledWith(expect.objectContaining({
      id: 'job-1',
      options: expect.objectContaining({
        seed: 98765,
        randomizeSeed: true,
        videoPrompt: 'animate {a|b}',
        resolvedVideoPrompt: 'animate b',
        promptTemplate: 'animate {a|b}',
        resolvedPrompt: 'animate b',
        resolvedPromptSeed: 98765,
      }),
    }));
  });

  it('submits the WAN22 looped flag when enabled', async () => {
    let generateFormData: FormData | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url === '/api/generate') {
        generateFormData = init?.body as FormData;
        return jsonResponse({ success: true, jobId: 'job-1', seed: 42 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'loop this shot' } });
    fireEvent.click(await screen.findByLabelText('Looped'));

    const imageInput = screen.getByLabelText('Upload reference image') as HTMLInputElement;
    const image = new File(['image'], 'source.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [image] } });

    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(generateFormData?.get('modelId')).toBe('wan22');
      expect(generateFormData?.get('looped')).toBe('true');
    });
  });

  it('keeps WAN22 random seed checked when a reference image is uploaded during draft restore', async () => {
    let resolveRestore: ((file: File | null) => void) | null = null;
    mockLoadFileFromPath.mockImplementation(() => new Promise<File | null>((resolve) => {
      resolveRestore = resolve;
    }));
    saveWorkflowDraft('video', 'wan22', {
      prompt: 'old prompt',
      randomizeSeed: false,
      parameterValues: { seed: 42 },
      imagePreviewUrl: '/old-reference.png',
    });

    render(React.createElement(VideoGenerationForm));

    const randomSeedCheckbox = await screen.findByLabelText('Random seed') as HTMLInputElement;
    fireEvent.click(randomSeedCheckbox);
    expect(randomSeedCheckbox.checked).toBe(true);

    const imageInput = screen.getByLabelText('Upload reference image') as HTMLInputElement;
    const image = new File(['image'], 'source.png', { type: 'image/png' });
    fireEvent.change(imageInput, { target: { files: [image] } });

    resolveRestore?.(new File(['old'], 'old-reference.png', { type: 'image/png' }));

    await waitFor(() => {
      expect((screen.getByLabelText('Random seed') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('restores the WAN22 random seed setting from a video preset', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({
          success: true,
          presets: [{
            id: 'preset-random',
            modelId: 'wan22',
            name: 'Random variants',
            prompt: 'camera {push|pull}',
            showAdvanced: false,
            randomizeSeed: true,
            parameterValues: { length: 81 },
            createdAt: 100,
            updatedAt: 200,
          }],
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    const randomSeedCheckbox = await screen.findByLabelText('Random seed') as HTMLInputElement;
    expect(randomSeedCheckbox.checked).toBe(false);

    fireEvent.click(screen.getByLabelText('Select img2vid preset'));
    fireEvent.click(await screen.findByText('Random variants'));

    await waitFor(() => {
      expect((screen.getByLabelText('Random seed') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('keeps WAN22 Create Video defaults at 4 steps and 80 frames', () => {
    const model = getModelById('wan22');
    expect(model?.parameters.find((param) => param.name === 'steps')?.default).toBe(4);
    expect(model?.parameters.find((param) => param.name === 'length')?.default).toBe(80);
    expect(model?.parameters.find((param) => param.name === 'length')?.min).toBeLessThanOrEqual(80);
    expect(model?.parameters.find((param) => param.name === 'length')?.max).toBe(512);
  });

  it('exposes WAN22 sigma shift as an advanced slider from 3 to 8', () => {
    const sigmaShift = getModelById('wan22')?.parameters.find((param) => param.name === 'sigma_shift');
    expect(sigmaShift).toMatchObject({
      label: 'Sigma shift',
      type: 'number',
      default: 5,
      min: 3,
      max: 8,
      step: 1,
      group: 'advanced',
      control: 'slider',
    });
  });

  it('exposes WAN22 FPS as a 16/32 segmented control', () => {
    const fps = getModelById('wan22')?.parameters.find((param) => param.name === 'fps');
    expect(fps).toMatchObject({
      label: 'FPS',
      type: 'select',
      options: ['16', '32'],
      default: '16',
      group: 'advanced',
      control: 'segmented',
    });
  });

  it('exposes WAN22 looped output as a basic checkbox', () => {
    const looped = getModelById('wan22')?.parameters.find((param) => param.name === 'looped');
    expect(looped).toMatchObject({
      label: 'Looped',
      type: 'boolean',
      default: false,
      group: 'basic',
    });
  });

  it('exposes additional LoRA pair parameters for WAN22 T2V', () => {
    const model = getModelById('wan22-t2v');
    expect(model?.parameters.filter((param) => param.type === 'lora-selector').map((param) => param.name)).toEqual([
      'lora_high_1',
      'lora_low_1',
      'lora_high_2',
      'lora_low_2',
      'lora_high_3',
      'lora_low_3',
      'lora_high_4',
      'lora_low_4',
    ]);
  });

  it('keeps WAN22 T2V on base LightX2V defaults without sigma shift or FPS controls', () => {
    const model = getModelById('wan22-t2v');
    const sigmaShift = model?.parameters.find((param) => param.name === 'sigma_shift');
    const fps = model?.parameters.find((param) => param.name === 'fps');
    const steps = model?.parameters.find((param) => param.name === 'steps');

    expect(steps?.default).toBe(4);
    expect(sigmaShift).toBeUndefined();
    expect(fps).toBeUndefined();
  });

  it('renders the random seed toggle for WAN22 T2V', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');

    render(React.createElement(VideoGenerationForm));

    expect(await screen.findByLabelText('Random seed')).toBeTruthy();
  });

  it('submits randomizeSeed and reflects the returned WAN22 T2V seed when enabled', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');
    let generateFormData: FormData | null = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url === '/api/generate') {
        generateFormData = init?.body as FormData;
        return jsonResponse({
          success: true,
          jobId: 't2v-job-1',
          prompt: 'wide dolly shot {left|right}',
          resolvedPrompt: 'wide dolly shot right',
          seed: 98765,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const { container } = render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'wide dolly shot {left|right}' } });
    fireEvent.click(screen.getByLabelText('Random seed'));

    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(generateFormData?.get('modelId')).toBe('wan22-t2v');
      expect(generateFormData?.get('randomizeSeed')).toBe('true');
      expect(generateFormData?.get('prompt')).toBe('wide dolly shot {left|right}');
    });

    await waitFor(() => {
      const seedInput = container.querySelector('input[name="seed"]') as HTMLInputElement | null;
      expect(seedInput?.value).toBe('98765');
    });
    expect(mockAddJob).toHaveBeenCalledWith(expect.objectContaining({
      id: 't2v-job-1',
      modelId: 'wan22-t2v',
      options: expect.objectContaining({
        seed: 98765,
        randomizeSeed: true,
        videoPrompt: 'wide dolly shot {left|right}',
        resolvedVideoPrompt: 'wide dolly shot right',
        promptTemplate: 'wide dolly shot {left|right}',
        resolvedPrompt: 'wide dolly shot right',
        resolvedPromptSeed: 98765,
      }),
    }));
  });

  it('renders the LoRA pair picker for WAN22 T2V', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');

    render(React.createElement(VideoGenerationForm));

    const advancedButton = await screen.findByRole('button', { name: 'generationForm.advancedSettings' });
    fireEvent.click(advancedButton);

    expect(await screen.findAllByLabelText('high-weight')).toHaveLength(4);
    expect(await screen.findAllByLabelText('low-weight')).toHaveLength(4);
  });

  it('saves WAN22 T2V default parameters into the video draft', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'wide cinematic establishing shot' } });

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts['wan22-t2v'].draft).toMatchObject({
        prompt: 'wide cinematic establishing shot',
        parameterValues: {
          width: 832,
          height: 480,
          seed: 42,
          cfg: 1,
          steps: 4,
          length: 81,
        },
      });
      expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('sigma_shift');
      expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('fps');
    });
  });

  it('flushes edited WAN22 T2V parameters when the mobile form unmounts', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');

    const firstRender = render(React.createElement(VideoGenerationForm));

    await screen.findByTestId('video-create-prompt-textarea');
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues.width).toBe(832);
    });

    const widthInput = firstRender.container.querySelector('input[name="width"]') as HTMLInputElement | null;
    expect(widthInput).toBeTruthy();
    fireEvent.change(widthInput!, { target: { value: '1024' } });

    fireEvent.click(screen.getByRole('button', { name: 'generationForm.advancedSettings' }));
    const stepsInput = firstRender.container.querySelector('input[name="steps"]') as HTMLInputElement | null;
    expect(stepsInput).toBeTruthy();
    fireEvent.change(stepsInput!, { target: { value: '8' } });

    firstRender.unmount();

    const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).toMatchObject({
      width: 1024,
      steps: 8,
      height: 480,
      seed: 42,
      length: 81,
    });
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('sigma_shift');
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('fps');

    render(React.createElement(VideoGenerationForm));

    const restoredWidthInput = await waitFor(() => (
      screen.getByDisplayValue('1024') as HTMLInputElement
    ));
    expect(restoredWidthInput.getAttribute('name')).toBe('width');
    fireEvent.click(screen.getByRole('button', { name: 'generationForm.advancedSettings' }));
    const restoredStepsInput = document.querySelector('input[name="steps"]') as HTMLInputElement | null;
    expect(restoredStepsInput?.value).toBe('8');
  });

  it('saves edited WAN22 T2V parameters immediately on change', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');

    const rendered = render(React.createElement(VideoGenerationForm));

    await screen.findByTestId('video-create-prompt-textarea');
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues.width).toBe(832);
    });

    const widthInput = rendered.container.querySelector('input[name="width"]') as HTMLInputElement | null;
    expect(widthInput).toBeTruthy();
    fireEvent.change(widthInput!, { target: { value: '1024' } });

    const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).toMatchObject({
      width: 1024,
      height: 480,
      seed: 42,
      length: 81,
    });
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('sigma_shift');
    expect(stored.workflows.video.drafts['wan22-t2v'].draft.parameterValues).not.toHaveProperty('fps');
  });

  it('saves WAN22 T2V default parameters into video presets', async () => {
    setWorkflowActiveModel('video', 'wan22-t2v');
    let savedPresetBody: any = null;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url === '/api/create/video-presets') {
        savedPresetBody = JSON.parse(String(init?.body || '{}'));
        return jsonResponse({ success: true, presets: [savedPresetBody.preset] });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'text only camera move' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Save current img2vid preset' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'T2V defaults' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(savedPresetBody?.preset).toMatchObject({
        modelId: 'wan22-t2v',
        name: 'T2V defaults',
        prompt: 'text only camera move',
        parameterValues: {
          width: 832,
          height: 480,
          seed: 42,
          cfg: 1,
          steps: 4,
          length: 81,
        },
      });
      expect(savedPresetBody?.preset.parameterValues).not.toHaveProperty('sigma_shift');
      expect(savedPresetBody?.preset.parameterValues).not.toHaveProperty('fps');
    });
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

  it('contains uploaded Wan Animate source video previews instead of cropping them', async () => {
    setWorkflowActiveModel('video', 'wan-animate');
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:wan-animate-source-video'),
    });

    const { container } = render(React.createElement(VideoGenerationForm));

    const fileInput = container.querySelector('input[type="file"][accept="video/*"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['video'], 'portrait.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    const preview = container.querySelector('video[src="blob:wan-animate-source-video"]') as HTMLVideoElement | null;
    expect(preview).toBeTruthy();
    expect(preview?.className).toContain('object-contain');
    expect(preview?.className).not.toContain('object-cover');
  });

  it('sets Wan Animate output dimensions from source video metadata and scales them without changing ratio', async () => {
    setWorkflowActiveModel('video', 'wan-animate');
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:wan-animate-source-video'),
    });

    const { container } = render(React.createElement(VideoGenerationForm));

    const fileInput = container.querySelector('input[type="file"][accept="video/*"]') as HTMLInputElement | null;
    expect(fileInput).toBeTruthy();

    const file = new File(['video'], 'portrait-720x1280.mp4', { type: 'video/mp4' });
    fireEvent.change(fileInput!, { target: { files: [file] } });

    const preview = container.querySelector('video[src="blob:wan-animate-source-video"]') as HTMLVideoElement | null;
    expect(preview).toBeTruthy();
    Object.defineProperty(preview!, 'videoWidth', { configurable: true, value: 720 });
    Object.defineProperty(preview!, 'videoHeight', { configurable: true, value: 1280 });
    fireEvent.loadedMetadata(preview!);

    const widthInput = container.querySelector('input[name="width"]') as HTMLInputElement | null;
    const heightInput = container.querySelector('input[name="height"]') as HTMLInputElement | null;

    await waitFor(() => {
      expect(widthInput?.value).toBe('720');
      expect(heightInput?.value).toBe('1280');
    });
    expect(screen.getByText('Source 720 × 1280')).toBeTruthy();

    fireEvent.change(widthInput!, { target: { value: '360' } });
    expect(widthInput?.value).toBe('360');
    expect(heightInput?.value).toBe('640');

    fireEvent.click(screen.getByRole('button', { name: 'Scale dimensions up' }));
    expect(widthInput?.value).toBe('450');
    expect(heightInput?.value).toBe('800');

    fireEvent.change(heightInput!, { target: { value: '1280' } });
    expect(widthInput?.value).toBe('720');
    expect(heightInput?.value).toBe('1280');
  });

  it('selects a Wan Animate reference image from Gallery', async () => {
    setWorkflowActiveModel('video', 'wan-animate');

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/gallery/assets?')) {
        expect(url).toContain('type=image');
        expect(url).toContain('bucket=all');
        return jsonResponse({
          success: true,
          assets: [
            {
              id: 'gallery-ref-1',
              type: 'image',
              originalUrl: '/generations/gallery/ws-1/ref.png',
              previewUrl: '/generations/gallery/ws-1/ref-preview.jpg',
              thumbnailUrl: '/generations/gallery/ws-1/ref-thumb.jpg',
              prompt: 'gallery reference prompt',
              modelId: 'z-image',
              addedToGalleryAt: new Date().toISOString(),
            },
          ],
          pagination: { page: 1, limit: 48, totalCount: 1, hasNextPage: false, hasPrevPage: false },
        });
      }
      if (url === '/generations/gallery/ws-1/ref.png') {
        return blobResponse(new Blob(['gallery-image'], { type: 'image/png' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    fireEvent.click(await screen.findByRole('button', { name: 'Choose reference image from Gallery' }));
    const galleryButton = await screen.findByRole('button', { name: 'Use Gallery image gallery-ref-1' });
    fireEvent.click(galleryButton);

    await waitFor(() => {
      expect(screen.queryByText('Choose reference image')).toBeNull();
    });
    expect((await screen.findByAltText('Reference') as HTMLImageElement).getAttribute('src')).toBe('/generations/gallery/ws-1/ref.png');

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts['wan-animate'].draft.imagePreviewUrl).toBe('/generations/gallery/ws-1/ref.png');
      expect(stored.workflows.video.drafts['wan-animate'].draft.parameterValues.sourceImageGenerationSnapshot).toMatchObject({
        galleryAssetId: 'gallery-ref-1',
        prompt: 'gallery reference prompt',
        modelId: 'z-image',
        imageInputPath: '/generations/gallery/ws-1/ref.png',
      });
    });
  });

  it('loads later Gallery reference picker pages for virtualized rows', async () => {
    setWorkflowActiveModel('video', 'wan-animate');
    mockVirtualRows.mockReturnValue([{ index: 30, key: 'row-30', start: 3960, size: 132 }]);

    const requestedPages: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/create/video-presets?workspaceId=ws-1')) {
        return jsonResponse({ success: true, presets: [] });
      }
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-wildcards?workspaceId=ws-1')) {
        return jsonResponse({ success: true, wildcards: [] });
      }
      if (url.includes('/api/gallery/assets?')) {
        const page = new URL(url, 'http://localhost').searchParams.get('page') || '1';
        requestedPages.push(page);
        const pageNumber = Number(page);
        return jsonResponse({
          success: true,
          assets: Array.from({ length: 48 }, (_, index) => ({
            id: `gallery-ref-${pageNumber}-${index}`,
            type: 'image',
            originalUrl: `/generations/gallery/ws-1/ref-${pageNumber}-${index}.png`,
            previewUrl: null,
            thumbnailUrl: null,
            prompt: `gallery reference ${pageNumber}-${index}`,
            modelId: 'z-image',
            addedToGalleryAt: new Date().toISOString(),
          })),
          pagination: { page: pageNumber, limit: 48, totalCount: 96, hasNextPage: pageNumber < 2, hasPrevPage: pageNumber > 1 },
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    fireEvent.click(await screen.findByRole('button', { name: 'Choose reference image from Gallery' }));

    await waitFor(() => {
      expect(requestedPages).toContain('1');
      expect(requestedPages).toContain('2');
    }, { timeout: 2000 });
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
          width: 768,
          height: 512,
          frameCount: 80,
          durationSeconds: 5,
          fps: 16,
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

  it('clears the WAN22 video prompt from the form control', async () => {
    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'prompt to clear' } });

    fireEvent.click(screen.getByRole('button', { name: 'Clear prompt' }));

    expect(promptTextarea.value).toBe('');
  });

  it('edits the desktop Create Video prompt in a larger prompt editor dialog', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'small prompt' } });
    fireEvent.focus(promptTextarea);

    const editorTextarea = await screen.findByTestId('video-create-prompt-editor-textarea') as HTMLTextAreaElement;
    expect(editorTextarea.value).toBe('small prompt');

    fireEvent.change(editorTextarea, { target: { value: 'expanded video prompt' } });
    expect(promptTextarea.value).toBe('small prompt');

    fireEvent.click(screen.getByRole('button', { name: 'Save prompt' }));

    await waitFor(() => {
      expect(screen.queryByTestId('video-create-prompt-editor-textarea')).toBeNull();
    });
    expect(promptTextarea.value).toBe('expanded video prompt');
  });

  it('cancels the desktop Create Video prompt editor without changing the prompt', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'original video prompt' } });
    fireEvent.focus(promptTextarea);

    const editorTextarea = await screen.findByTestId('video-create-prompt-editor-textarea') as HTMLTextAreaElement;
    fireEvent.change(editorTextarea, { target: { value: 'discarded edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByTestId('video-create-prompt-editor-textarea')).toBeNull();
    });
    expect(promptTextarea.value).toBe('original video prompt');
  });

  it('sends an empty prompt when the WAN22 Prompt Helper empty-prompt option is enabled', async () => {
    window.localStorage.setItem('engui:video-prompt-helper:instruction', 'make it cinematic');

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/prompt-helper/improve')) {
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body).toMatchObject({
          prompt: '',
          instruction: 'make it cinematic',
          modelId: 'wan22',
          helperProfile: 'wan22-video',
          width: 768,
          height: 512,
          frameCount: 80,
          durationSeconds: 5,
          fps: 16,
        });
        return textResponse('generated from empty prompt');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(React.createElement(VideoGenerationForm));

    const promptTextarea = await screen.findByTestId('video-create-prompt-textarea') as HTMLTextAreaElement;
    fireEvent.change(promptTextarea, { target: { value: 'existing prompt should be cleared first' } });
    fireEvent.click(screen.getByLabelText('Empty prompt'));

    await waitFor(() => {
      expect((screen.getByTitle('Apply saved WAN 2.2 Prompt Helper instruction') as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByTitle('Apply saved WAN 2.2 Prompt Helper instruction'));

    await waitFor(() => {
      expect(promptTextarea.value).toBe('generated from empty prompt');
    });
  });

  it('persists the WAN22 Prompt Helper empty-prompt option across remounts', async () => {
    const firstRender = render(React.createElement(VideoGenerationForm));

    const emptyPromptCheckbox = await screen.findByLabelText('Empty prompt') as HTMLInputElement;
    expect(emptyPromptCheckbox.checked).toBe(false);

    fireEvent.click(emptyPromptCheckbox);
    expect(emptyPromptCheckbox.checked).toBe(true);

    await waitFor(() => {
      expect(window.localStorage.getItem('engui:video-prompt-helper:empty-prompt')).toBe('true');
    });

    firstRender.unmount();
    render(React.createElement(VideoGenerationForm));

    await waitFor(() => {
      expect((screen.getByLabelText('Empty prompt') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('caches source image context before applying WAN22 Prompt Helper again', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:video-reference-preview'),
    });

    let visionRequestCount = 0;
    let promptRequestCount = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('data:image/png')) {
        return blobResponse(new Blob(['image'], { type: 'image/png' }));
      }
      if (url.includes('/api/lora?workspaceId=ws-1')) {
        return jsonResponse({ success: true, loras: [] });
      }
      if (url.includes('/api/vision-prompt-helper/extract')) {
        visionRequestCount += 1;
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.modelId).toBe('wan22');
        expect(body.imageDataUrl).toContain('data:image/png;base64');
        expect(body.instruction).toContain('WAN2.2 image-to-video');
        return jsonResponse({ success: true, prompt: 'A woman in a red dress stands by a window.' });
      }
      if (url.includes('/api/prompt-helper/improve')) {
        promptRequestCount += 1;
        const body = JSON.parse(String(init?.body || '{}'));
        expect(body.modelId).toBe('wan22');
        expect(body.helperProfile).toBe('wan22-video');
        expect(body.instruction).toContain('Source image context for WAN2.2 image-to-video prompting');
        expect(body.instruction).toContain('A woman in a red dress stands by a window.');
        expect(body.instruction).toContain('Treat explicit user requests for action, pose, body movement, expression, or camera change as intentional direction');
        expect(body.instruction).toContain('Make that requested movement the primary motion beat');
        expect(body.instruction).toContain('Transform short abstract action phrases into concrete observable choreography');
        expect(body.instruction).toContain('For dance prompts, spell out hips, torso, shoulders, hands');
        expect(body.instruction).not.toContain('outfit, pose, framing');
        if (promptRequestCount === 1) {
          return textResponse('A woman in a red dress walks forward from the window, natural motion, steady camera.');
        }
        if (promptRequestCount === 2) {
          return textResponse('A woman in a red dress turns beside the window, natural motion, steady camera.');
        }
        return textResponse('A woman in a red dress dances beside the window, natural motion, steady camera.');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const firstRender = render(React.createElement(VideoGenerationForm));

    const fileInput = firstRender.container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement | null;
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
    expect(visionRequestCount).toBe(1);

    fireEvent.change(promptTextarea, { target: { value: 'make her turn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prompt Helper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(promptTextarea.value).toBe('A woman in a red dress turns beside the window, natural motion, steady camera.');
    });
    expect(visionRequestCount).toBe(1);
    expect(promptRequestCount).toBe(2);

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
      expect(stored.workflows.video.drafts.wan22.draft.imagePreviewUrl).toBeTruthy();
    });

    const stored = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || '{}');
    stored.workflows.video.drafts.wan22.draft.imagePreviewUrl = 'data:image/png;base64,aW1hZ2U=';
    window.localStorage.setItem(CREATE_DRAFT_STATE_STORAGE_KEY, JSON.stringify(stored));

    firstRender.unmount();
    render(React.createElement(VideoGenerationForm));

    const restoredPromptTextarea = await screen.findByPlaceholderText('generationForm.describeYourVideo') as HTMLTextAreaElement;
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png/));
    });

    fireEvent.change(restoredPromptTextarea, { target: { value: 'make her dance' } });
    fireEvent.click(screen.getByRole('button', { name: 'Prompt Helper' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(restoredPromptTextarea.value).toBe('A woman in a red dress dances beside the window, natural motion, steady camera.');
    });
    expect(visionRequestCount).toBe(1);
    expect(promptRequestCount).toBe(3);
  });
});
