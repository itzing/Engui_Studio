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

function normalizeZImageLoraPath(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const withoutWeightSuffix = trimmed.match(/^(.*?),(?:-?\d+(?:\.\d+)?)$/)?.[1]?.trim() || trimmed;
  if (withoutWeightSuffix.startsWith('/')) {
    return withoutWeightSuffix;
  }

  return `/runpod-volume/loras/${withoutWeightSuffix.replace(/^\/+/, '')}`;
}

function normalizeZImageLoraWeight(options: Record<string, any>): number | undefined {
  if (typeof options.zImageLora === 'string') {
    const match = options.zImageLora.trim().match(/,(-?\d+(?:\.\d+)?)$/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  if (typeof options.zImageLoraWeight === 'number' && Number.isFinite(options.zImageLoraWeight)) {
    return options.zImageLoraWeight;
  }

  if (Array.isArray(options.lora) && Array.isArray(options.lora[0])) {
    const [, loraWeight] = options.lora[0];
    if (typeof loraWeight === 'number' && Number.isFinite(loraWeight)) {
      return loraWeight;
    }
  }

  return undefined;
}

function normalizeZImageLoraSlots(options: Record<string, any>): Array<{ path: string; weight: number }> {
  if (Array.isArray(options.zImageLoraSlots)) {
    return options.zImageLoraSlots
      .map((slot: any) => ({
        path: normalizeZImageLoraPath(slot?.path),
        weight: typeof slot?.weight === 'number' && Number.isFinite(slot.weight)
          ? slot.weight
          : 1.0,
      }))
      .filter((slot) => slot.path);
  }

  const legacyPath = normalizeZImageLoraPath(options.zImageLora)
    || (Array.isArray(options.lora) && Array.isArray(options.lora[0])
      ? normalizeZImageLoraPath(options.lora[0][0])
      : '');
  const legacyWeight = normalizeZImageLoraWeight(options);

  return legacyPath
    ? [{ path: legacyPath, weight: typeof legacyWeight === 'number' && Number.isFinite(legacyWeight) ? legacyWeight : 1.0 }]
    : [];
}

export function persistCreateReuseDraft(detail: ReuseDetail, defaults = { imageModelId: 'flux-krea', videoModelId: 'wan22' }) {
  const parsedOptions = parseReuseOptions(detail.options);

  if (detail.type === 'image') {
    const modelId = detail.modelId || defaults.imageModelId;
    const model = getModelById(modelId);
    const parameterValues: Record<string, any> = {};

    Object.keys(parsedOptions).forEach((key) => {
      if (!key.includes('_path') && key !== 'runpodJobId' && key !== 'error') {
        if (modelId === 'z-image' && key === 'lora') {
          return;
        }
        parameterValues[key] = parsedOptions[key];
      }
    });

    const primaryImagePath = detail.imageInputPath || parsedOptions.image_path;

    if (modelId === 'z-image') {
      const normalizedLoraSlots = normalizeZImageLoraSlots(parsedOptions).slice(0, 4);

      normalizedLoraSlots.forEach((slot, index) => {
        const loraKey = index === 0 ? 'lora' : `lora${index + 1}`;
        const loraWeightKey = index === 0 ? 'loraWeight' : `loraWeight${index + 1}`;
        parameterValues[loraKey] = slot.path;
        parameterValues[loraWeightKey] = slot.weight;
      });

      if (!primaryImagePath) {
        parameterValues.use_controlnet = false;
      }
    }

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
