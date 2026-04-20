'use client';

import { createImageDraftSnapshot, normalizeRandomizeSeed } from '@/lib/create/imageDraft';
import { saveWorkflowDraft, setActiveMode, setWorkflowActiveModel } from '@/lib/createDrafts';
import { getModelById, isInputVisible } from '@/lib/models/modelConfig';

type ReuseDetail = {
  type?: string | null;
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

export function persistImageReuseDraft(detail: ReuseDetail, defaultModelId = 'flux-krea') {
  if (detail.type !== 'image') {
    return null;
  }

  const parsedOptions = parseReuseOptions(detail.options);
  const modelId = detail.modelId || defaultModelId;
  const nextModel = getModelById(modelId);
  const parameterValues: Record<string, any> = {};

  Object.keys(parsedOptions).forEach((key) => {
    if (!key.includes('_path') && key !== 'runpodJobId' && key !== 'error') {
      parameterValues[key] = parsedOptions[key];
    }
  });

  const primaryImagePath = detail.imageInputPath || parsedOptions.image_path;
  const secondaryImagePath = parsedOptions.image_path_2;
  const shouldReusePrimaryImage = !!(nextModel && isInputVisible(nextModel, 'image', parameterValues));
  const shouldReuseSecondaryImage = !!(nextModel && isInputVisible(nextModel, 'image2', parameterValues));

  const snapshot = createImageDraftSnapshot({
    prompt: detail.prompt || '',
    showAdvanced: true,
    randomizeSeed: normalizeRandomizeSeed(parsedOptions.randomizeSeed),
    parameterValues,
    previewUrl: shouldReusePrimaryImage && primaryImagePath ? primaryImagePath : '',
    previewUrl2: shouldReuseSecondaryImage && secondaryImagePath ? secondaryImagePath : '',
  });

  setActiveMode('image');
  setWorkflowActiveModel('image', modelId);
  saveWorkflowDraft('image', modelId, snapshot);

  return {
    modelId,
    snapshot,
  };
}
