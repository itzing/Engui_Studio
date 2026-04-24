import type { CreateMediaRef } from '@/lib/create/createDraftSchema';
import { getModelById, isInputVisible } from '@/lib/models/modelConfig';

export type ImageCreateDraftSnapshot = {
  prompt?: string;
  showAdvanced?: boolean;
  randomizeSeed?: boolean | string | number;
  parameterValues?: Record<string, any>;
  previewUrl?: string;
  previewUrl2?: string;
  selectedSceneId?: string;
  sceneSnapshot?: Record<string, any> | null;
  sourcePromptDocumentId?: string;
  sourcePromptDocumentTitle?: string;
  inputs?: {
    primary?: CreateMediaRef | null;
    secondary?: CreateMediaRef | null;
  };
};

export const generateRandomSeed = () => Math.floor(Math.random() * 2147483647) + 1;

export const normalizeRandomizeSeed = (value: unknown) => {
  return value === true || value === 'true' || value === 1 || value === '1';
};

export const buildDefaultImageParameterValues = (modelId: string) => {
  const model = getModelById(modelId);
  const initialValues: Record<string, any> = {};
  model?.parameters.forEach(param => {
    if (param.default !== undefined) {
      initialValues[param.name] = param.default;
    }
  });
  return initialValues;
};

export const mergeImageDraftParameterValues = (
  modelId: string,
  parameterValues?: Record<string, any> | null,
) => {
  return {
    ...buildDefaultImageParameterValues(modelId),
    ...((parameterValues && typeof parameterValues === 'object') ? parameterValues : {}),
  };
};

export const createImageDraftSnapshot = (snapshot: ImageCreateDraftSnapshot): ImageCreateDraftSnapshot => ({
  prompt: snapshot.prompt || '',
  showAdvanced: snapshot.showAdvanced === true,
  randomizeSeed: normalizeRandomizeSeed(snapshot.randomizeSeed),
  parameterValues: snapshot.parameterValues || {},
  previewUrl: snapshot.previewUrl || '',
  previewUrl2: snapshot.previewUrl2 || '',
  selectedSceneId: snapshot.selectedSceneId || '',
  sceneSnapshot: snapshot.sceneSnapshot && typeof snapshot.sceneSnapshot === 'object' ? snapshot.sceneSnapshot : null,
  sourcePromptDocumentId: snapshot.sourcePromptDocumentId || '',
  sourcePromptDocumentTitle: snapshot.sourcePromptDocumentTitle || '',
  inputs: {
    primary: snapshot.inputs?.primary || null,
    secondary: snapshot.inputs?.secondary || null,
  },
});

export const normalizeImageDraftForModel = (
  modelId: string,
  snapshot?: ImageCreateDraftSnapshot | null,
): ImageCreateDraftSnapshot => {
  const model = getModelById(modelId);
  const allowedParameterNames = new Set((model?.parameters || []).map((param) => param.name));
  const filteredParameterValues = Object.fromEntries(
    Object.entries((snapshot?.parameterValues && typeof snapshot.parameterValues === 'object') ? snapshot.parameterValues : {})
      .filter(([key]) => allowedParameterNames.has(key)),
  );
  const parameterValues = mergeImageDraftParameterValues(modelId, filteredParameterValues);
  const primaryImageVisible = !!(model && isInputVisible(model, 'image', parameterValues));
  const secondaryImageVisible = !!(model && isInputVisible(model, 'image2', parameterValues));

  return createImageDraftSnapshot({
    prompt: snapshot?.prompt || '',
    showAdvanced: snapshot?.showAdvanced === true,
    randomizeSeed: snapshot?.randomizeSeed,
    parameterValues,
    previewUrl: primaryImageVisible ? (snapshot?.previewUrl || '') : '',
    previewUrl2: secondaryImageVisible ? (snapshot?.previewUrl2 || '') : '',
    selectedSceneId: snapshot?.selectedSceneId || '',
    sceneSnapshot: snapshot?.sceneSnapshot && typeof snapshot.sceneSnapshot === 'object' ? snapshot.sceneSnapshot : null,
    sourcePromptDocumentId: snapshot?.sourcePromptDocumentId || '',
    sourcePromptDocumentTitle: snapshot?.sourcePromptDocumentTitle || '',
    inputs: {
      primary: primaryImageVisible ? (snapshot?.inputs?.primary || null) : null,
      secondary: secondaryImageVisible ? (snapshot?.inputs?.secondary || null) : null,
    },
  });
};
