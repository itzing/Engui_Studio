'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CreateMediaRef } from '@/lib/create/createDraftSchema';
import {
  createImageDraftSnapshot,
  mergeImageDraftParameterValues,
  normalizeImageDraftForModel,
  normalizeRandomizeSeed,
  type ImageCreateDraftSnapshot,
} from '@/lib/create/imageDraft';
import { resolveCreateMediaRefToFile, storeCreateFile } from '@/lib/create/createMediaStore';
import { requestImagePromptImprovement } from '@/lib/create/imagePromptHelper';
import { submitImageGeneration } from '@/lib/create/submitImageGeneration';
import { useStudio } from '@/lib/context/StudioContext';
import { getModelById, getModelsByType, isInputVisible, type ModelConfig, type ModelParameter } from '@/lib/models/modelConfig';
import { useImageCreateDraftPersistence } from '@/hooks/create/useImageCreateDraftPersistence';
import type { LoRAFile } from '@/components/lora/LoRASelector';

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

export function useImageCreateState() {
  const { settings, addJob, activeWorkspaceId } = useStudio();

  const imageModels = useMemo(() => getModelsByType('image'), []);
  const DEFAULT_IMAGE_MODEL = imageModels[0]?.id || 'flux-krea';

  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_IMAGE_MODEL);
  const [prompt, setPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [randomizeSeed, setRandomizeSeed] = useState(false);
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewUrl2, setPreviewUrl2] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageFile2, setImageFile2] = useState<File | null>(null);
  const [primaryInputRef, setPrimaryInputRef] = useState<CreateMediaRef | null>(null);
  const [secondaryInputRef, setSecondaryInputRef] = useState<CreateMediaRef | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<FlashMessage>(null);
  const [availableLoras, setAvailableLoras] = useState<LoRAFile[]>([]);
  const [isLoadingLoras, setIsLoadingLoras] = useState(false);
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
  const hasPrimaryImage = !!(imageFile || primaryInputRef || previewUrl);

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

  const hasLoRAParameter = useMemo(() => {
    return !!currentModel?.parameters.some((param) => param.type === 'lora-selector');
  }, [currentModel]);


  const currentSnapshot = useMemo((): ImageCreateDraftSnapshot => createImageDraftSnapshot({
    prompt,
    showAdvanced,
    randomizeSeed,
    parameterValues,
    previewUrl,
    previewUrl2,
    inputs: {
      primary: primaryInputRef,
      secondary: secondaryInputRef,
    },
  }), [parameterValues, previewUrl, previewUrl2, primaryInputRef, secondaryInputRef, prompt, randomizeSeed, showAdvanced]);

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
    setImageFile(null);
    setImageFile2(null);
    setPrimaryInputRef(normalizedSnapshot.inputs?.primary || null);
    setSecondaryInputRef(normalizedSnapshot.inputs?.secondary || null);

    if (normalizedSnapshot.inputs?.primary?.kind === 'idb-media') {
      const file = await resolveCreateMediaRefToFile(normalizedSnapshot.inputs.primary);
      if (file) {
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    } else if (normalizedSnapshot.previewUrl?.startsWith('data:')) {
      setImageFile(await dataUrlToFile(normalizedSnapshot.previewUrl, 'image-input'));
    }

    if (normalizedSnapshot.inputs?.secondary?.kind === 'idb-media') {
      const file = await resolveCreateMediaRefToFile(normalizedSnapshot.inputs.secondary);
      if (file) {
        setImageFile2(file);
        setPreviewUrl2(URL.createObjectURL(file));
      }
    } else if (normalizedSnapshot.previewUrl2?.startsWith('data:')) {
      setImageFile2(await dataUrlToFile(normalizedSnapshot.previewUrl2, 'image-input-2'));
    }
  }, []);

  const { hydrateSnapshot, switchModel } = useImageCreateDraftPersistence({
    defaultModelId: DEFAULT_IMAGE_MODEL,
    selectedModel,
    setSelectedModel,
    snapshot: currentSnapshot,
    applySnapshot,
  });

  useEffect(() => {
    if (!selectedModel || !imageModels.some((model) => model.id === selectedModel)) {
      setSelectedModel(DEFAULT_IMAGE_MODEL);
    }
  }, [DEFAULT_IMAGE_MODEL, imageModels, selectedModel]);

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

    const fetchAvailableLoras = async () => {
      if (!activeWorkspaceId || !hasLoRAParameter) {
        setAvailableLoras([]);
        return;
      }

      setIsLoadingLoras(true);
      try {
        const response = await fetch(`/api/lora?workspaceId=${activeWorkspaceId}`);
        const data = await response.json();

        if (!cancelled) {
          setAvailableLoras(data.success && Array.isArray(data.loras) ? data.loras : []);
        }
      } catch {
        if (!cancelled) {
          setAvailableLoras([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLoras(false);
        }
      }
    };

    void fetchAvailableLoras();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspaceId, hasLoRAParameter]);

  useEffect(() => {
    if (!currentModel?.parameters.some((param) => param.name === 'use_controlnet')) {
      return;
    }

    setParameterValues((prev) => {
      if (prev.use_controlnet === hasPrimaryImage) {
        return prev;
      }

      return {
        ...prev,
        use_controlnet: hasPrimaryImage,
      };
    });
  }, [currentModel, hasPrimaryImage]);

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

  const setPrimaryImage = useCallback((file: File | null, nextPreviewUrl = '', inputRef: CreateMediaRef | null = null) => {
    setImageFile(file);
    setPreviewUrl(nextPreviewUrl);
    setPrimaryInputRef(inputRef);
    if (nextPreviewUrl) {
      updateDimensionsFromImageUrl(nextPreviewUrl);
    }
  }, [updateDimensionsFromImageUrl]);

  const setSecondaryImage = useCallback((file: File | null, nextPreviewUrl = '', inputRef: CreateMediaRef | null = null) => {
    setImageFile2(file);
    setPreviewUrl2(nextPreviewUrl);
    setSecondaryInputRef(inputRef);
  }, []);

  const selectPrimaryImageFile = useCallback(async (file: File) => {
    const storedRef = await storeCreateFile(file);
    setPrimaryImage(file, URL.createObjectURL(file), storedRef);
  }, [setPrimaryImage]);

  const selectSecondaryImageFile = useCallback(async (file: File) => {
    const storedRef = await storeCreateFile(file);
    setSecondaryImage(file, URL.createObjectURL(file), storedRef);
  }, [setSecondaryImage]);


  const handleParameterChange = useCallback((paramName: string, value: any) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  }, []);

  const handleNumericParameterInput = useCallback((paramName: string, rawValue: string) => {
    if (/^loraWeight\d*$/.test(paramName)) {
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
      sceneSnapshot: currentSnapshot.sceneSnapshot || null,
      sourcePromptDocumentId: currentSnapshot.sourcePromptDocumentId || null,
      sourcePromptDocumentTitle: currentSnapshot.sourcePromptDocumentTitle || null,
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
  }, [activeWorkspaceId, addJob, currentModel, currentSnapshot.sceneSnapshot, currentSnapshot.sourcePromptDocumentId, currentSnapshot.sourcePromptDocumentTitle, imageFile, imageFile2, parameterValues, previewUrl, previewUrl2, prompt, randomizeSeed, setTimedMessage, settings]);

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

  const controlNetEnabled = parameterValues.use_controlnet === true;
  const supportsControlNet = !!currentModel?.parameters.some((param) => param.name === 'use_controlnet');

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
    controlNetEnabled,
    supportsControlNet,
    parameterValues,
    handleParameterChange,
    handleNumericParameterInput,
    editableParameters,
    basicParameters,
    basicSummaryItems,
    availableLoras,
    isLoadingLoras,
    isParameterVisible,
    previewUrl,
    previewUrl2,
    imageFile,
    imageFile2,
    selectPrimaryImageFile,
    selectSecondaryImageFile,
    clearPrimaryImage: () => setPrimaryImage(null, '', null),
    clearSecondaryImage: () => setSecondaryImage(null, '', null),
    primaryImageVisible,
    secondaryImageVisible,
    primaryImageRequired,
    secondaryImageRequired,
    isLoadingMedia,
    isGenerating,
    message,
    setMessage,
    submit,
    selectModel: async (modelId: string) => {
      await switchModel(modelId, currentSnapshot);
    },
    promptHelperInstruction,
    setPromptHelperInstruction,
    isPromptHelperConfigured,
    promptHelperError,
    isPromptHelperLoading,
    runSavedPromptHelperInstruction,
  };
}
