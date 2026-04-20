import { getModelById } from '@/lib/models/modelConfig';

export type ImageCreateDraftSnapshot = {
  prompt?: string;
  showAdvanced?: boolean;
  randomizeSeed?: boolean | string | number;
  parameterValues?: Record<string, any>;
  previewUrl?: string;
  previewUrl2?: string;
  selectedSceneId?: string;
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
});
