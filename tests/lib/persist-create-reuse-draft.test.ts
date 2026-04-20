import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveMode = vi.fn();
const setWorkflowActiveModel = vi.fn();
const saveWorkflowDraft = vi.fn();
const getModelById = vi.fn();
const isInputVisible = vi.fn();

vi.mock('@/lib/createDrafts', () => ({
  setActiveMode,
  setWorkflowActiveModel,
  saveWorkflowDraft,
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
    getModelById.mockReset();
    isInputVisible.mockReset();
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
