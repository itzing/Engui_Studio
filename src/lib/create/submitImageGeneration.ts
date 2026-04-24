import type { StudioSettings } from '@/lib/context/StudioContext';
import { loadFileFromPath } from '@/lib/fileUtils';
import { isInputVisible, type ModelConfig } from '@/lib/models/modelConfig';
import { generateRandomSeed } from './imageDraft';

export type SubmitImageGenerationParams = {
  currentModel: ModelConfig;
  prompt: string;
  parameterValues: Record<string, any>;
  randomizeSeed: boolean;
  activeWorkspaceId: string | null;
  settings: StudioSettings;
  imageFile: File | null;
  imageFile2: File | null;
  imagePreviewUrl?: string | null;
  imagePreviewUrl2?: string | null;
  dimensions?: string | null;
  sceneSnapshot?: Record<string, any> | null;
  sourcePromptDocumentId?: string | null;
  sourcePromptDocumentTitle?: string | null;
};

export type SubmitImageGenerationResult =
  | {
      success: true;
      job: {
        id: string;
        modelId: string;
        type: 'image';
        status: 'queued';
        prompt: string;
        createdAt: number;
        endpointId?: string;
        options: Record<string, any>;
      };
      nextSeed: number | null;
    }
  | {
      success: false;
      error: string;
      nextSeed: number | null;
    };

export const submitImageGeneration = async ({
  currentModel,
  prompt,
  parameterValues,
  randomizeSeed,
  activeWorkspaceId,
  settings,
  imageFile,
  imageFile2,
  imagePreviewUrl,
  imagePreviewUrl2,
  dimensions,
  sceneSnapshot,
  sourcePromptDocumentId,
  sourcePromptDocumentTitle,
}: SubmitImageGenerationParams): Promise<SubmitImageGenerationResult> => {
  if (currentModel.inputs.includes('text') && !prompt) {
    return { success: false, error: 'Prompt is required', nextSeed: null };
  }

  const imageVisible = isInputVisible(currentModel, 'image', parameterValues);
  const image2Visible = isInputVisible(currentModel, 'image2', parameterValues);
  const imageOptional = currentModel.optionalInputs?.includes('image');
  const image2Optional = currentModel.optionalInputs?.includes('image2');

  let resolvedImageFile = imageFile;
  let resolvedImageFile2 = imageFile2;

  if (!resolvedImageFile && imagePreviewUrl) {
    resolvedImageFile = await loadFileFromPath(imagePreviewUrl);
  }

  if (!resolvedImageFile2 && imagePreviewUrl2) {
    resolvedImageFile2 = await loadFileFromPath(imagePreviewUrl2);
  }

  if (imageVisible && !imageOptional && !resolvedImageFile) {
    return { success: false, error: 'Please upload an image for this model', nextSeed: null };
  }

  if (image2Visible && !image2Optional && !resolvedImageFile2) {
    return { success: false, error: 'Please upload the second image', nextSeed: null };
  }

  const shouldRandomizeSeed = randomizeSeed && currentModel.parameters.some(param => param.name === 'seed');
  const nextSeed = shouldRandomizeSeed ? generateRandomSeed() : null;

  try {
    const formData = new FormData();
    formData.append('userId', 'user-with-settings');
    formData.append('modelId', currentModel.id);
    formData.append('prompt', prompt);

    if (activeWorkspaceId) {
      formData.append('workspaceId', activeWorkspaceId);
    }

    if (imageVisible && resolvedImageFile) {
      formData.append('image', resolvedImageFile);
    }

    if (resolvedImageFile2) {
      formData.append('image2', resolvedImageFile2);
    }

    currentModel.parameters.forEach(param => {
      const value = parameterValues[param.name] ?? param.default;

      if (value !== undefined && value !== null) {
        formData.append(param.name, value.toString());
      }
    });

    formData.append('randomizeSeed', randomizeSeed ? 'true' : 'false');

    if (dimensions) {
      formData.append('dimensions', dimensions);
    }

    if (sceneSnapshot && typeof sceneSnapshot === 'object') {
      formData.append('sceneSnapshot', JSON.stringify(sceneSnapshot));
    }

    if (sourcePromptDocumentId) {
      formData.append('sourcePromptDocumentId', sourcePromptDocumentId);
    }

    if (sourcePromptDocumentTitle) {
      formData.append('sourcePromptDocumentTitle', sourcePromptDocumentTitle);
    }

    const headers: Record<string, string> = {};
    if (settings.apiKeys.openai) headers['X-OpenAI-Key'] = settings.apiKeys.openai;
    if (settings.apiKeys.google) headers['X-Google-Key'] = settings.apiKeys.google;
    if (settings.apiKeys.kling) headers['X-Kling-Key'] = settings.apiKeys.kling;
    if (settings.apiKeys.runpod) headers['X-RunPod-Key'] = settings.apiKeys.runpod;

    if (currentModel.api.type === 'runpod') {
      const endpointId = settings.runpod.endpoints[currentModel.id] || currentModel.api.endpoint;
      headers['X-RunPod-Endpoint-Id'] = endpointId;
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Generation failed',
        nextSeed,
      };
    }

    return {
      success: true,
      job: {
        id: data.jobId,
        modelId: currentModel.id,
        type: 'image',
        status: 'queued',
        prompt,
        createdAt: Date.now(),
        endpointId: headers['X-RunPod-Endpoint-Id'],
        options: {
          ...parameterValues,
          randomizeSeed,
        },
      },
      nextSeed,
    };
  } catch {
    return {
      success: false,
      error: 'An unexpected error occurred',
      nextSeed,
    };
  }
};
