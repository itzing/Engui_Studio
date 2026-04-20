'use client';

import { createImageDraftSnapshot, normalizeImageDraftForModel, normalizeRandomizeSeed } from '@/lib/create/imageDraft';
import { saveWorkflowDraft, setActiveMode, setWorkflowActiveModel } from '@/lib/createDrafts';
import { getModelById, isInputVisible } from '@/lib/models/modelConfig';

type ReuseDetail = {
  action?: 'txt2img' | 'img2img' | 'img2vid' | string | null;
  type?: 'image' | 'video' | string | null;
  modelId?: string | null;
  prompt?: string | null;
  options?: unknown;
  imageInputPath?: string | null;
};

function parseReuseOptions(options: unknown): Record<string, any> {
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return {};
    }
  }

  return options && typeof options === 'object' ? options as Record<string, any> : {};
}

export function persistCreateReuseDraft(detail: ReuseDetail, defaults = { imageModelId: 'flux-krea', videoModelId: 'wan22' }) {
  const parsedOptions = parseReuseOptions(detail.options);

  if (detail.type === 'image') {
    const modelId = detail.modelId || defaults.imageModelId;
    const model = getModelById(modelId);
    const parameterValues: Record<string, any> = {};

    Object.keys(parsedOptions).forEach((key) => {
      if (!key.includes('_path') && key !== 'runpodJobId' && key !== 'error') {
        parameterValues[key] = parsedOptions[key];
      }
    });

    const primaryImagePath = detail.imageInputPath || parsedOptions.image_path;
    const secondaryImagePath = parsedOptions.image_path_2;
    const shouldReusePrimaryImage = !!(model && isInputVisible(model, 'image', parameterValues));
    const shouldReuseSecondaryImage = !!(model && isInputVisible(model, 'image2', parameterValues));

    const snapshot = normalizeImageDraftForModel(modelId, createImageDraftSnapshot({
      prompt: detail.prompt || '',
      showAdvanced: true,
      randomizeSeed: normalizeRandomizeSeed(parsedOptions.randomizeSeed),
      parameterValues,
      previewUrl: shouldReusePrimaryImage && primaryImagePath ? primaryImagePath : '',
      previewUrl2: shouldReuseSecondaryImage && secondaryImagePath ? secondaryImagePath : '',
      inputs: {
        primary: shouldReusePrimaryImage && primaryImagePath ? {
          kind: 'remote-url',
          url: primaryImagePath,
          source: 'job',
        } : null,
        secondary: shouldReuseSecondaryImage && secondaryImagePath ? {
          kind: 'remote-url',
          url: secondaryImagePath,
          source: 'job',
        } : null,
      },
    }));

    setActiveMode('image');
    setWorkflowActiveModel('image', modelId);
    saveWorkflowDraft('image', modelId, snapshot);

    return { workflow: 'image' as const, modelId, snapshot };
  }

  if (detail.type === 'video') {
    const modelId = detail.modelId || defaults.videoModelId;
    const snapshot = {
      prompt: detail.prompt || '',
      showAdvanced: true,
      parameterValues: Object.fromEntries(
        Object.entries(parsedOptions).filter(([key]) => !key.includes('_path') && key !== 'runpodJobId' && key !== 'error')
      ),
      imagePreviewUrl: detail.imageInputPath || parsedOptions.image_path || '',
      videoPreviewUrl: typeof parsedOptions.video_path === 'string' ? parsedOptions.video_path : '',
    };

    setActiveMode('video');
    setWorkflowActiveModel('video', modelId);
    saveWorkflowDraft('video', modelId, snapshot);

    return { workflow: 'video' as const, modelId, snapshot };
  }

  return null;
}
