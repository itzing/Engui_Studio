import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveMode = vi.fn();
const setWorkflowActiveModel = vi.fn();
const saveWorkflowDraft = vi.fn();
const getWorkflowActiveModel = vi.fn();
const getWorkflowDraft = vi.fn();
const getModelById = vi.fn();
const isInputVisible = vi.fn();

vi.mock('@/lib/createDrafts', () => ({
  setActiveMode,
  setWorkflowActiveModel,
  saveWorkflowDraft,
  getWorkflowActiveModel,
  getWorkflowDraft,
}));

vi.mock('@/lib/models/modelConfig', () => ({
  getModelById,
  isInputVisible,
}));

describe('persistCreateReuseDraft', () => {
  beforeEach(() => {
    setActiveMode.mockReset();
    setWorkflowActiveModel.mockReset();
    saveWorkflowDraft.mockReset();
    getWorkflowActiveModel.mockReset();
    getWorkflowDraft.mockReset();
    getModelById.mockReset();
    isInputVisible.mockReset();
  });

  it('updates only the prompt and scene linkage in the current image draft for Prompt Constructor handoff', async () => {
    getWorkflowActiveModel.mockReturnValue('flux-dev');
    getWorkflowDraft.mockReturnValue({
      prompt: 'old prompt',
      showAdvanced: true,
      randomizeSeed: true,
      parameterValues: { width: 1344, height: 768, lora: '/runpod-volume/loras/existing.safetensors' },
      previewUrl: '/generations/reference.png',
      previewUrl2: '',
      inputs: {
        primary: { kind: 'remote-url', url: '/generations/reference.png', source: 'job' },
        secondary: null,
      },
    });
    getModelById.mockReturnValue({
      id: 'flux-dev',
      parameters: [
        { name: 'width', default: 1024 },
        { name: 'height', default: 1024 },
        { name: 'lora', default: '' },
      ],
    });
    isInputVisible.mockImplementation((_model, input) => input === 'image');
    const { persistPromptIntoImageCreateDraft } = await import('@/lib/create/persistCreateReuseDraft');

    const result = persistPromptIntoImageCreateDraft({
      prompt: 'new prompt only',
      sceneSnapshot: { templateId: 'scene_template_v2' },
      sourcePromptDocumentId: 'scene-1',
      sourcePromptDocumentTitle: 'Temple reunion',
    });

    expect(result?.workflow).toBe('image');
    expect(result?.modelId).toBe('flux-dev');
    expect(setActiveMode).toHaveBeenCalledWith('image');
    expect(setWorkflowActiveModel).toHaveBeenCalledWith('image', 'flux-dev');
    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'flux-dev', expect.objectContaining({
      prompt: 'new prompt only',
      randomizeSeed: true,
      parameterValues: expect.objectContaining({
        width: 1344,
        height: 768,
        lora: '/runpod-volume/loras/existing.safetensors',
      }),
      previewUrl: '/generations/reference.png',
      inputs: expect.objectContaining({
        primary: expect.objectContaining({ url: '/generations/reference.png' }),
      }),
      sourcePromptDocumentId: 'scene-1',
      sourcePromptDocumentTitle: 'Temple reunion',
      sceneSnapshot: { templateId: 'scene_template_v2' },
    }));
  });

  it('writes img2img payloads into the image workflow draft before navigation', async () => {
    getModelById.mockReturnValue({
      id: 'flux-dev',
      parameters: [
        { name: 'width', default: 1024 },
        { name: 'use_controlnet', default: false },
      ],
    });
    isInputVisible.mockImplementation((_model, input) => input === 'image');
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    const result = persistCreateReuseDraft({
      type: 'image',
      modelId: 'flux-dev',
      prompt: 'cat portrait',
      imageInputPath: '/generations/cat.png',
      options: { width: 1024, use_controlnet: true, image_path: '/generations/cat.png' },
    });

    expect(result?.workflow).toBe('image');
    expect(setActiveMode).toHaveBeenCalledWith('image');
    expect(setWorkflowActiveModel).toHaveBeenCalledWith('image', 'flux-dev');
    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'flux-dev', expect.objectContaining({
      prompt: 'cat portrait',
      previewUrl: '/generations/cat.png',
      inputs: expect.objectContaining({
        primary: expect.objectContaining({ kind: 'remote-url', url: '/generations/cat.png' }),
      }),
    }));
  });

  it('clears z-image controlnet mode when reuse payload has no image input', async () => {
    getModelById.mockReturnValue({
      id: 'z-image',
      parameters: [
        { name: 'use_controlnet', default: false },
        { name: 'width', default: 1024 },
      ],
    });
    isInputVisible.mockImplementation((_model, input, params) => input === 'image' && params?.use_controlnet === true);
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    persistCreateReuseDraft({
      type: 'image',
      modelId: 'z-image',
      prompt: 'cinematic portrait',
      options: { use_controlnet: true, width: 1024 },
    });

    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'z-image', expect.objectContaining({
      previewUrl: '',
      parameterValues: expect.objectContaining({ use_controlnet: false, width: 1024 }),
      inputs: expect.objectContaining({ primary: null }),
    }));
  });

  it('restores z-image lora fields from persisted reuse metadata', async () => {
    getModelById.mockReturnValue({
      id: 'z-image',
      parameters: [
        { name: 'lora', default: '' },
        { name: 'loraWeight', default: 1 },
        { name: 'use_controlnet', default: false },
      ],
    });
    isInputVisible.mockReturnValue(false);
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    persistCreateReuseDraft({
      type: 'image',
      modelId: 'z-image',
      prompt: 'cinematic portrait',
      options: {
        use_controlnet: false,
        lora: [['Age_Slider_v1.1_ZIT_RMX.safetensors', -1]],
        zImageLora: '/runpod-volume/loras/Age_Slider_v1.1_ZIT_RMX.safetensors',
        zImageLoraWeight: -1,
      },
    });

    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'z-image', expect.objectContaining({
      parameterValues: expect.objectContaining({
        lora: '/runpod-volume/loras/Age_Slider_v1.1_ZIT_RMX.safetensors',
        loraWeight: -1,
        use_controlnet: false,
      }),
    }));
  });

  it('normalizes legacy z-image lora strings that have filename and weight glued together', async () => {
    getModelById.mockReturnValue({
      id: 'z-image',
      parameters: [
        { name: 'lora', default: '' },
        { name: 'loraWeight', default: 1 },
        { name: 'use_controlnet', default: false },
      ],
    });
    isInputVisible.mockReturnValue(false);
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    persistCreateReuseDraft({
      type: 'image',
      modelId: 'z-image',
      prompt: 'cinematic portrait',
      options: {
        use_controlnet: false,
        lora: [['Age_Slider_v1.1_ZIT_RMX.safetensors,-1', 1]],
        zImageLora: 'Age_Slider_v1.1_ZIT_RMX.safetensors,-1',
        zImageLoraWeight: 1,
      },
    });

    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'z-image', expect.objectContaining({
      parameterValues: expect.objectContaining({
        lora: '/runpod-volume/loras/Age_Slider_v1.1_ZIT_RMX.safetensors',
        loraWeight: -1,
      }),
    }));
  });

  it('restores up to 4 z-image lora slots from persisted slot metadata', async () => {
    getModelById.mockReturnValue({
      id: 'z-image',
      parameters: [
        { name: 'lora', default: '' },
        { name: 'loraWeight', default: 1 },
        { name: 'lora2', default: '' },
        { name: 'loraWeight2', default: 1 },
        { name: 'lora3', default: '' },
        { name: 'loraWeight3', default: 1 },
        { name: 'lora4', default: '' },
        { name: 'loraWeight4', default: 1 },
        { name: 'use_controlnet', default: false },
      ],
    });
    isInputVisible.mockReturnValue(false);
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    persistCreateReuseDraft({
      type: 'image',
      modelId: 'z-image',
      prompt: 'cinematic portrait',
      options: {
        use_controlnet: false,
        zImageLoraSlots: [
          { path: '/runpod-volume/loras/one.safetensors', weight: 0.8 },
          { path: '/runpod-volume/loras/two.safetensors', weight: -1 },
          { path: '/runpod-volume/loras/three.safetensors', weight: 0.35 },
          { path: '/runpod-volume/loras/four.safetensors', weight: 1.2 },
        ],
      },
    });

    expect(saveWorkflowDraft).toHaveBeenCalledWith('image', 'z-image', expect.objectContaining({
      parameterValues: expect.objectContaining({
        lora: '/runpod-volume/loras/one.safetensors',
        loraWeight: 0.8,
        lora2: '/runpod-volume/loras/two.safetensors',
        loraWeight2: -1,
        lora3: '/runpod-volume/loras/three.safetensors',
        loraWeight3: 0.35,
        lora4: '/runpod-volume/loras/four.safetensors',
        loraWeight4: 1.2,
      }),
    }));
  });

  it('writes img2vid payloads into the video workflow draft before navigation', async () => {
    const { persistCreateReuseDraft } = await import('@/lib/create/persistCreateReuseDraft');

    const result = persistCreateReuseDraft({
      type: 'video',
      modelId: 'wan22',
      prompt: 'camera push in',
      imageInputPath: '/generations/keyframe.png',
      options: { width: 768, height: 512, image_path: '/generations/keyframe.png' },
    });

    expect(result?.workflow).toBe('video');
    expect(setActiveMode).toHaveBeenCalledWith('video');
    expect(setWorkflowActiveModel).toHaveBeenCalledWith('video', 'wan22');
    expect(saveWorkflowDraft).toHaveBeenCalledWith('video', 'wan22', expect.objectContaining({
      prompt: 'camera push in',
      imagePreviewUrl: '/generations/keyframe.png',
      parameterValues: expect.objectContaining({ width: 768, height: 512 }),
    }));
  });
});
