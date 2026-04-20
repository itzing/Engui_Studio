'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PENDING_REUSE_KEY } from '@/components/mobile/MobileRouteEventBridge';
import {
  createImageDraftSnapshot,
  mergeImageDraftParameterValues,
  normalizeRandomizeSeed,
  type ImageCreateDraftSnapshot,
} from '@/lib/create/imageDraft';
import { setWorkflowActiveModel } from '@/lib/createDrafts';
import { requestImagePromptImprovement } from '@/lib/create/imagePromptHelper';
import { applyScenePromptToImageDraft, applySceneToImageDraft, fetchActiveScenePresets } from '@/lib/create/imageScenes';
import { submitImageGeneration } from '@/lib/create/submitImageGeneration';
import { useStudio } from '@/lib/context/StudioContext';
import { loadFileFromPath } from '@/lib/fileUtils';
import { getModelById, getModelsByType, isInputVisible, type ModelConfig, type ModelParameter } from '@/lib/models/modelConfig';
import type { ScenePresetSummary } from '@/lib/scenes/types';
import { useImageCreateDraftPersistence } from '@/hooks/create/useImageCreateDraftPersistence';

const PROMPT_HELPER_INSTRUCTION_STORAGE_KEY = 'engui:prompt-helper:instruction';

type FlashMessage = {
  type: 'success' | 'error';
  text: string;
} | null;

const dataUrlToFile = async (dataUrl: string, filename: string, fallbackType = 'application/octet-stream') => {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type || fallbackType });
};

const parseReuseOptions = (options: unknown) => {
  if (typeof options === 'string') {
    try {
      return JSON.parse(options);
    } catch {
      return {};
    }
  }
  return (options && typeof options === 'object') ? options as Record<string, any> : {};
};

export function useImageCreateState() {
  const { selectedModel, setSelectedModel, settings, addJob, activeWorkspaceId } = useStudio();

  const imageModels = useMemo(() => getModelsByType('image'), []);
  const DEFAULT_IMAGE_MODEL = imageModels[0]?.id || 'flux-krea';

  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [randomizeSeed, setRandomizeSeed] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewUrl2, setPreviewUrl2] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [availableScenes, setAvailableScenes] = useState<ScenePresetSummary[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [isLoadingScenes, setIsLoadingScenes] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<FlashMessage>(null);
  const [promptHelperInstruction, setPromptHelperInstruction] = useState('');
  const [promptHelperError, setPromptHelperError] = useState<string | null>(null);
  const [isPromptHelperLoading, setIsPromptHelperLoading] = useState(false);

  const successTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current !== null) {
        window.clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const currentModel = useMemo(() => {
    return getModelById(selectedModel || '') || getModelById(DEFAULT_IMAGE_MODEL) || imageModels[0];
  }, [DEFAULT_IMAGE_MODEL, imageModels, selectedModel]);

  const isParameterVisible = useCallback((param: ModelParameter, values = parameterValues) => {
    if (!param.dependsOn) return true;
    return values[param.dependsOn.parameter] === param.dependsOn.value;
  }, [parameterValues]);

  const primaryImageVisible = !!(currentModel && isInputVisible(currentModel, 'image', parameterValues));
  const secondaryImageVisible = !!(currentModel && isInputVisible(currentModel, 'image2', parameterValues));
  const primaryImageRequired = primaryImageVisible && !currentModel?.optionalInputs?.includes('image');
  const secondaryImageRequired = secondaryImageVisible && !currentModel?.optionalInputs?.includes('image2');

  const negativePromptParameterName = currentModel?.parameters.find(
    (param) => param.name === 'negativePrompt' || param.name === 'negative_prompt'
  )?.name;
  const currentNegativePrompt = negativePromptParameterName
    ? String(parameterValues[negativePromptParameterName] ?? currentModel?.parameters.find((param) => param.name === negativePromptParameterName)?.default ?? '')
    : '';
  const widthParameter = currentModel?.parameters.find((param) => param.name === 'width');
  const heightParameter = currentModel?.parameters.find((param) => param.name === 'height');
  const currentWidth = widthParameter ? Number(parameterValues[widthParameter.name] ?? widthParameter.default) : undefined;
  const currentHeight = heightParameter ? Number(parameterValues[heightParameter.name] ?? heightParameter.default) : undefined;

  const basicParameters = useMemo(() => {
    if (!currentModel) return [];
    return currentModel.parameters.filter((param) => param.group === 'basic' && isParameterVisible(param));
  }, [currentModel, isParameterVisible]);

  const editableParameters = useMemo(() => {
    if (!currentModel) return [];
    return currentModel.parameters.filter((param) => param.group !== 'hidden' && isParameterVisible(param));
  }, [currentModel, isParameterVisible]);

  const selectedScene = useMemo(() => {
    return availableScenes.find((scene) => scene.id === selectedSceneId) || null;
  }, [availableScenes, selectedSceneId]);

  const currentSnapshot = useMemo((): ImageCreateDraftSnapshot => createImageDraftSnapshot({
    prompt,
    showAdvanced,
    randomizeSeed,
    parameterValues,
    previewUrl,
    previewUrl2,
    selectedSceneId,
  }), [parameterValues, previewUrl, previewUrl2, prompt, randomizeSeed, selectedSceneId, showAdvanced]);

  const applySnapshot = useCallback(async (modelId: string, snapshot?: ImageCreateDraftSnapshot | null) => {
    const mergedParameterValues = mergeImageDraftParameterValues(modelId, snapshot?.parameterValues);
    const normalizedSnapshot = createImageDraftSnapshot({
      ...snapshot,
      parameterValues: mergedParameterValues,
    });

    setPrompt(normalizedSnapshot.prompt || '');
    setShowAdvanced(normalizedSnapshot.showAdvanced === true);
    setRandomizeSeed(normalizeRandomizeSeed(normalizedSnapshot.randomizeSeed));
    setParameterValues(mergedParameterValues);
    setPreviewUrl(normalizedSnapshot.previewUrl || '');
    setPreviewUrl2(normalizedSnapshot.previewUrl2 || '');
    setSelectedSceneId(normalizedSnapshot.selectedSceneId || '');
    setImageFile(null);
    setImageFile2(null);

    if (normalizedSnapshot.previewUrl?.startsWith('data:')) {
      setImageFile(await dataUrlToFile(normalizedSnapshot.previewUrl, 'image-input'));
    }
    if (normalizedSnapshot.previewUrl2?.startsWith('data:')) {
      setImageFile2(await dataUrlToFile(normalizedSnapshot.previewUrl2, 'image-input-2'));
    }
  }, []);

  const { hydrateSnapshot, skipNextModelHydration } = useImageCreateDraftPersistence({
    defaultModelId: DEFAULT_IMAGE_MODEL,
    selectedModel,
    setSelectedModel,
    snapshot: currentSnapshot,
    applySnapshot,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const syncSelectedModel = () => {
      const modelId = getWorkflowActiveModel('image') || DEFAULT_IMAGE_MODEL;
      if (!modelId) return;
      setSelectedModel(modelId);
    };

    window.addEventListener('pageshow', syncSelectedModel);
    window.addEventListener('focus', syncSelectedModel);
    document.addEventListener('visibilitychange', syncSelectedModel);

    return () => {
      window.removeEventListener('pageshow', syncSelectedModel);
      window.removeEventListener('focus', syncSelectedModel);
      document.removeEventListener('visibilitychange', syncSelectedModel);
    };
  }, [DEFAULT_IMAGE_MODEL, setSelectedModel]);

  useEffect(() => {
    const nextModelId = selectedModel || DEFAULT_IMAGE_MODEL;
    if (!selectedModel || !imageModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(nextModelId);
    }
  }, [DEFAULT_IMAGE_MODEL, imageModels, selectedModel, setSelectedModel]);

  useEffect(() => {
    try {
      const storedInstruction = window.localStorage.getItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY);
      if (storedInstruction !== null) {
        setPromptHelperInstruction(storedInstruction);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      if (promptHelperInstruction.trim()) {
        window.localStorage.setItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY, promptHelperInstruction);
      } else {
        window.localStorage.removeItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [promptHelperInstruction]);

  useEffect(() => {
    let cancelled = false;
    const loadScenes = async () => {
      setIsLoadingScenes(true);
      try {
        const scenes = await fetchActiveScenePresets(activeWorkspaceId);
        if (!cancelled) {
          setAvailableScenes(scenes);
        }
      } catch {
        if (!cancelled) {
          setAvailableScenes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingScenes(false);
        }
      }
    };

    void loadScenes();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId]);

  const setTimedMessage = useCallback((nextMessage: FlashMessage) => {
    setMessage(nextMessage);
    if (successTimerRef.current !== null) {
      window.clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (nextMessage?.type === 'success') {
      successTimerRef.current = window.setTimeout(() => {
        setMessage(null);
        successTimerRef.current = null;
      }, 2200);
    }
  }, []);

  const updateDimensionsFromImageUrl = useCallback((url: string) => {
    if (!url || !widthParameter || !heightParameter) return;
    const image = new Image();
    image.onload = () => {
      setParameterValues((prev) => ({
        ...prev,
        [widthParameter.name]: image.width,
        [heightParameter.name]: image.height,
      }));
    };
    image.src = url;
  }, [heightParameter, widthParameter]);

  const setPrimaryImage = useCallback((file: File | null, nextPreviewUrl = '') => {
    setImageFile(file);
    setPreviewUrl(nextPreviewUrl);
    if (nextPreviewUrl) {
      updateDimensionsFromImageUrl(nextPreviewUrl);
    }
  }, [updateDimensionsFromImageUrl]);

  const setSecondaryImage = useCallback((file: File | null, nextPreviewUrl = '') => {
    setImageFile2(file);
    setPreviewUrl2(nextPreviewUrl);
  }, []);

  const selectPrimaryImageFile = useCallback((file: File) => {
    setPrimaryImage(file, URL.createObjectURL(file));
  }, [setPrimaryImage]);

  const selectSecondaryImageFile = useCallback((file: File) => {
    setSecondaryImage(file, URL.createObjectURL(file));
  }, [setSecondaryImage]);

  const applyScenePreviewImage = useCallback(async (sceneOverride?: ScenePresetSummary | null) => {
    const targetScene = sceneOverride || selectedScene;
    if (!targetScene?.latestPreviewImageUrl) return;
    setIsLoadingMedia(true);
    try {
      setSelectedSceneId(targetScene.id);
      setPreviewUrl(targetScene.latestPreviewImageUrl);
      const file = await loadFileFromPath(targetScene.latestPreviewImageUrl);
      if (file) {
        setPrimaryImage(file, targetScene.latestPreviewImageUrl);
      }
    } finally {
      setIsLoadingMedia(false);
    }
  }, [selectedScene, setPrimaryImage]);

  const applySelectedSceneToPrompt = useCallback((sceneOverride?: ScenePresetSummary | null) => {
    const targetScene = sceneOverride || selectedScene;
    if (!targetScene) return;
    const nextSnapshot = applyScenePromptToImageDraft(currentSnapshot, targetScene);
    setPrompt(nextSnapshot.prompt || '');
    setSelectedSceneId(nextSnapshot.selectedSceneId || '');
  }, [currentSnapshot, selectedScene]);

  const applyAllFromScene = useCallback(async (sceneOverride?: ScenePresetSummary | null) => {
    const targetScene = sceneOverride || selectedScene;
    if (!targetScene) return;
    const nextSnapshot = applySceneToImageDraft(currentSnapshot, targetScene);
    setPrompt(nextSnapshot.prompt || '');
    setSelectedSceneId(nextSnapshot.selectedSceneId || '');
    if (nextSnapshot.previewUrl) {
      setPreviewUrl(nextSnapshot.previewUrl);
      await applyScenePreviewImage(targetScene);
    }
  }, [applyScenePreviewImage, currentSnapshot, selectedScene]);

  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  }, []);

  const handleNumericParameterInput = useCallback((paramName: string, rawValue: string) => {
    if (paramName === 'loraWeight') {
      if (/^-?\d*(\.\d*)?$/.test(rawValue)) {
        handleParameterChange(paramName, rawValue);
      }
      return;
    }

    handleParameterChange(paramName, rawValue === '' ? '' : Number(rawValue));
  }, [handleParameterChange]);

  const submit = useCallback(async () => {
    if (!currentModel) {
      setTimedMessage({ type: 'error', text: 'Model is not ready yet' });
      return false;
    }

    setMessage(null);
    setIsGenerating(true);
    const result = await submitImageGeneration({
      currentModel,
      prompt,
      parameterValues,
      randomizeSeed,
      activeWorkspaceId,
      settings,
      imageFile,
      imageFile2,
      imagePreviewUrl: previewUrl,
      imagePreviewUrl2: previewUrl2,
      dimensions: null,
    });

    if (result.success) {
      addJob(result.job);
      setTimedMessage({ type: 'success', text: 'Generation started' });
    } else {
      setTimedMessage({ type: 'error', text: result.error });
    }

    if (result.nextSeed !== null) {
      setParameterValues((prev) => ({
        ...prev,
        seed: result.nextSeed,
      }));
    }

    setIsGenerating(false);
    return result.success;
  }, [activeWorkspaceId, addJob, currentModel, imageFile, imageFile2, parameterValues, previewUrl, previewUrl2, prompt, randomizeSeed, setTimedMessage, settings]);

  const runSavedPromptHelperInstruction = useCallback(async () => {
    if (!currentModel || !promptHelperInstruction.trim() || isPromptHelperLoading) {
      return;
    }

    setPromptHelperError(null);
    setIsPromptHelperLoading(true);

    try {
      const data = await requestImagePromptImprovement({
        prompt,
        negativePrompt: currentNegativePrompt,
        instruction: promptHelperInstruction.trim(),
        modelId: currentModel.id,
        width: Number.isFinite(currentWidth) ? currentWidth : undefined,
        height: Number.isFinite(currentHeight) ? currentHeight : undefined,
      });

      setPrompt(data.improvedPrompt);
      if (negativePromptParameterName && typeof data.improvedNegativePrompt === 'string') {
        setParameterValues((prev) => ({
          ...prev,
          [negativePromptParameterName]: data.improvedNegativePrompt,
        }));
      }
      setTimedMessage({ type: 'success', text: 'Prompt improved' });
    } catch (error) {
      setPromptHelperError(error instanceof Error ? error.message : 'Prompt Helper request failed');
    } finally {
      setIsPromptHelperLoading(false);
    }
  }, [currentHeight, currentModel, currentNegativePrompt, currentWidth, negativePromptParameterName, prompt, promptHelperInstruction, isPromptHelperLoading, setTimedMessage]);

  const applyReuseDetail = useCallback(async (detail: any) => {
    if (detail.type !== 'image') return;

    setIsLoadingMedia(true);
    try {
      const parsedOptions = parseReuseOptions(detail.options);
      const nextModelId = detail.modelId || selectedModel || DEFAULT_IMAGE_MODEL;
      if (detail.modelId && detail.modelId !== selectedModel) {
        skipNextModelHydration();
        setSelectedModel(detail.modelId);
      }

      const allParamValues: Record<string, any> = {};
      Object.keys(parsedOptions).forEach((key) => {
        if (!key.includes('_path') && key !== 'runpodJobId' && key !== 'error') {
          allParamValues[key] = parsedOptions[key];
        }
      });

      const nextModel = getModelById(nextModelId) || currentModel;
      const primaryImagePath = detail.imageInputPath || parsedOptions.image_path;
      const secondaryImagePath = parsedOptions.image_path_2;
      const shouldReusePrimaryImage = !!(nextModel && isInputVisible(nextModel, 'image', allParamValues));
      const shouldReuseSecondaryImage = !!(nextModel && isInputVisible(nextModel, 'image2', allParamValues));

      const snapshot = createImageDraftSnapshot({
        prompt: detail.prompt || '',
        showAdvanced: true,
        randomizeSeed: normalizeRandomizeSeed(parsedOptions.randomizeSeed),
        parameterValues: allParamValues,
        previewUrl: shouldReusePrimaryImage && primaryImagePath ? primaryImagePath : '',
        previewUrl2: shouldReuseSecondaryImage && secondaryImagePath ? secondaryImagePath : '',
      });

      await hydrateSnapshot(nextModelId, snapshot);

      if (shouldReusePrimaryImage && primaryImagePath) {
        const file = await loadFileFromPath(primaryImagePath);
        if (file) {
          setPrimaryImage(file, primaryImagePath);
        }
      }

      if (shouldReuseSecondaryImage && secondaryImagePath) {
        const file = await loadFileFromPath(secondaryImagePath);
        if (file) {
          setSecondaryImage(file, secondaryImagePath);
        }
      }

      setTimedMessage({ type: 'success', text: 'Input reused in mobile create' });
    } finally {
      setIsLoadingMedia(false);
    }
  }, [DEFAULT_IMAGE_MODEL, currentModel, hydrateSnapshot, selectedModel, setPrimaryImage, setSecondaryImage, setSelectedModel, setTimedMessage, skipNextModelHydration]);

  useEffect(() => {
    const handleReuseInput = async (event: Event) => {
      const customEvent = event as CustomEvent;
      await applyReuseDetail(customEvent.detail || {});
    };

    window.addEventListener('reuseJobInput', handleReuseInput as EventListener);

    try {
      const pendingReuse = window.localStorage.getItem(PENDING_REUSE_KEY);
      if (pendingReuse) {
        const detail = JSON.parse(pendingReuse);
        void applyReuseDetail(detail).finally(() => {
          window.localStorage.removeItem(PENDING_REUSE_KEY);
        });
      }
    } catch {
      window.localStorage.removeItem(PENDING_REUSE_KEY);
    }

    return () => window.removeEventListener('reuseJobInput', handleReuseInput as EventListener);
  }, [applyReuseDetail]);

  const promptSummary = prompt.trim() || 'No prompt yet';
  const basicSummaryItems = useMemo(() => {
    const items: Array<{ label: string; value: string }> = [];
    if (widthParameter && heightParameter) {
      items.push({
        label: 'Size',
        value: `${parameterValues[widthParameter.name] ?? widthParameter.default} × ${parameterValues[heightParameter.name] ?? heightParameter.default}`,
      });
    }

    basicParameters
      .filter((param) => param.name !== 'width' && param.name !== 'height')
      .slice(0, 3)
      .forEach((param) => {
        const rawValue = parameterValues[param.name] ?? param.default;
        if (rawValue === undefined || rawValue === null || rawValue === '') return;
        items.push({
          label: param.label,
          value: typeof rawValue === 'boolean' ? (rawValue ? 'On' : 'Off') : String(rawValue),
        });
      });

    return items;
  }, [basicParameters, heightParameter, parameterValues, widthParameter]);

  const isPromptHelperConfigured = settings.promptHelper?.provider === 'local'
    && !!settings.promptHelper?.local?.baseUrl?.trim()
    && !!settings.promptHelper?.local?.model?.trim();

  return {
    imageModels,
    currentModel,
    selectedModel: currentModel?.id || DEFAULT_IMAGE_MODEL,
    prompt,
    setPrompt,
    promptSummary,
    showAdvanced,
    setShowAdvanced,
    randomizeSeed,
    setRandomizeSeed,
    parameterValues,
    handleParameterChange,
    handleNumericParameterInput,
    editableParameters,
    basicParameters,
    basicSummaryItems,
    isParameterVisible,
    previewUrl,
    previewUrl2,
    imageFile,
    imageFile2,
    selectPrimaryImageFile,
    selectSecondaryImageFile,
    clearPrimaryImage: () => setPrimaryImage(null, ''),
    clearSecondaryImage: () => setSecondaryImage(null, ''),
    primaryImageVisible,
    secondaryImageVisible,
    primaryImageRequired,
    secondaryImageRequired,
    availableScenes,
    selectedScene,
    selectedSceneId,
    setSelectedSceneId,
    isLoadingScenes,
    isLoadingMedia,
    isGenerating,
    message,
    setMessage,
    submit,
    selectModel: (modelId: string) => {
      setWorkflowActiveModel('image', modelId);
      setSelectedModel(modelId);
    },
    applySelectedSceneToPrompt,
    applyScenePreviewImage,
    applyAllFromScene,
    promptMatchesSelectedScene: !!selectedScene && prompt.trim() === (selectedScene.generatedScenePrompt || '').trim(),
    promptHelperInstruction,
    setPromptHelperInstruction,
    isPromptHelperConfigured,
    promptHelperError,
    isPromptHelperLoading,
    runSavedPromptHelperInstruction,
  };
}
