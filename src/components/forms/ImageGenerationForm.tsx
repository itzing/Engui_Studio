'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '@/lib/context/StudioContext';
import { getModelsByType, getModelById, isInputVisible } from '@/lib/models/modelConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeftRight, Check, Copy, ImagePlus, Loader2, Plus, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { LoRASelector, type LoRAFile } from '@/components/lora/LoRASelector';
import { LoRAManagementDialog } from '@/components/lora/LoRAManagementDialog';
import { useI18n } from '@/lib/i18n/context';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    type ImageCreateDraftSnapshot,
    createImageDraftSnapshot,
    mergeImageDraftParameterValues,
    normalizeRandomizeSeed,
} from '@/lib/create/imageDraft';
import { requestImagePromptImprovement, extractImagePromptFromDataUrl } from '@/lib/create/imagePromptHelper';
import { sanitizeHydratedLoraParameterValues } from '@/lib/create/loraDraftSanitizer';
import { submitImageGeneration } from '@/lib/create/submitImageGeneration';
import { useImageCreateDraftPersistence } from '@/hooks/create/useImageCreateDraftPersistence';
import type { PromptDocument, PromptDocumentSummary } from '@/lib/prompt-constructor/types';
import { documentUsesRandomCharacterAppearance, renderPromptDocumentForCreate } from '@/lib/prompt-constructor/renderForCreate';
import type { CharacterSummary } from '@/lib/characters/types';

export default function ImageGenerationForm() {
    const { t } = useI18n();
    const { settings, addJob, activeWorkspaceId } = useStudio();
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [prompt, setPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isPhoneLayout, setIsPhoneLayout] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [imageFile2, setImageFile2] = useState<File | null>(null);
    const [previewUrl2, setPreviewUrl2] = useState<string>('');
    const [parameterValues, setParameterValues] = useState<Record<string, any>>({});
    const [isLoadingMedia, setIsLoadingMedia] = useState(false);
    const [showReuseSuccess, setShowReuseSuccess] = useState(false);
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [randomizeSeed, setRandomizeSeed] = useState(false);
    const [promptDocuments, setPromptDocuments] = useState<PromptDocumentSummary[]>([]);
    const [isPromptDocumentsLoading, setIsPromptDocumentsLoading] = useState(false);
    const [isPromptDraftSyncing, setIsPromptDraftSyncing] = useState(false);
    const [selectedPromptDocumentId, setSelectedPromptDocumentId] = useState('');
    const [selectedPromptDocumentTitle, setSelectedPromptDocumentTitle] = useState('');
    const [sceneSnapshot, setSceneSnapshot] = useState<Record<string, any> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef2 = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const formElementRef = useRef<HTMLFormElement>(null);
    const imagePromptFileInputRef = useRef<HTMLInputElement>(null);

    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mediaQuery = window.matchMedia('(max-width: 767px)');
        const updateLayout = () => setIsPhoneLayout(mediaQuery.matches);
        updateLayout();
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', updateLayout);
            return () => mediaQuery.removeEventListener('change', updateLayout);
        }

        mediaQuery.addListener(updateLayout);
        return () => mediaQuery.removeListener(updateLayout);
    }, []);
    const [isPromptHelperOpen, setIsPromptHelperOpen] = useState(false);
    const [promptHelperInstruction, setPromptHelperInstruction] = useState('');
    const [promptHelperChangeNegative, setPromptHelperChangeNegative] = useState(false);
    const [promptHelperError, setPromptHelperError] = useState<string | null>(null);
    const [promptHelperDebug, setPromptHelperDebug] = useState<{ content?: string; reasoningContent?: string } | null>(null);
    const [isPromptHelperLoading, setIsPromptHelperLoading] = useState(false);
    const [isPromptHelperQuickAnimating, setIsPromptHelperQuickAnimating] = useState(false);
    const [isImagePromptOpen, setIsImagePromptOpen] = useState(false);
    const [imagePromptFile, setImagePromptFile] = useState<File | null>(null);
    const [imagePromptPreviewUrl, setImagePromptPreviewUrl] = useState('');
    const [imagePromptResult, setImagePromptResult] = useState('');
    const [hasCopiedImagePromptResult, setHasCopiedImagePromptResult] = useState(false);
    const [isVisionPromptLoading, setIsVisionPromptLoading] = useState(false);
    const [imagePromptElapsedMs, setImagePromptElapsedMs] = useState(0);
    const [imagePromptStartedAt, setImagePromptStartedAt] = useState<number | null>(null);
    const [isDimensionSwapHighlightActive, setIsDimensionSwapHighlightActive] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // LoRA state
    const [showLoRADialog, setShowLoRADialog] = useState(false);
    const [showDesktopLoraSelector, setShowDesktopLoraSelector] = useState(false);
    const [availableLoras, setAvailableLoras] = useState<LoRAFile[]>([]);
    const [isLoadingLoras, setIsLoadingLoras] = useState(false);

    const imageModels = getModelsByType('image');
    const DEFAULT_IMAGE_MODEL = imageModels[0]?.id || 'flux-krea';

    const PROMPT_HELPER_INSTRUCTION_STORAGE_KEY = 'engui:prompt-helper:instruction';

    const dataUrlToFile = async (dataUrl: string, filename: string, fallbackType = 'application/octet-stream') => {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return new File([blob], filename, { type: blob.type || fallbackType });
    };

    const currentSnapshot = useMemo(() => createImageDraftSnapshot({
        prompt,
        showAdvanced,
        randomizeSeed,
        parameterValues,
        previewUrl,
        previewUrl2,
        sceneSnapshot,
        sourcePromptDocumentId: selectedPromptDocumentId,
        sourcePromptDocumentTitle: selectedPromptDocumentTitle,
    }), [parameterValues, previewUrl, previewUrl2, prompt, randomizeSeed, sceneSnapshot, selectedPromptDocumentId, selectedPromptDocumentTitle, showAdvanced]);

    const applySnapshot = React.useCallback(async (modelId: string, snapshot?: ImageCreateDraftSnapshot | null) => {
        const mergedParameterValues = mergeImageDraftParameterValues(modelId, snapshot?.parameterValues);

        setPrompt(typeof snapshot?.prompt === 'string' ? snapshot.prompt : '');
        setShowAdvanced(typeof snapshot?.showAdvanced === 'boolean' ? snapshot.showAdvanced : false);
        setRandomizeSeed(normalizeRandomizeSeed(snapshot?.randomizeSeed));
        setParameterValues(mergedParameterValues);
        setSceneSnapshot(snapshot?.sceneSnapshot && typeof snapshot.sceneSnapshot === 'object' ? snapshot.sceneSnapshot : null);
        setSelectedPromptDocumentId(typeof snapshot?.sourcePromptDocumentId === 'string' ? snapshot.sourcePromptDocumentId : '');
        setSelectedPromptDocumentTitle(typeof snapshot?.sourcePromptDocumentTitle === 'string' ? snapshot.sourcePromptDocumentTitle : '');

        const nextPreviewUrl = typeof snapshot?.previewUrl === 'string' ? snapshot.previewUrl : '';
        const nextPreviewUrl2 = typeof snapshot?.previewUrl2 === 'string' ? snapshot.previewUrl2 : '';

        setPreviewUrl(nextPreviewUrl);
        setPreviewUrl2(nextPreviewUrl2);
        setImageFile(null);
        setImageFile2(null);

        if (nextPreviewUrl.startsWith('data:')) {
            setImageFile(await dataUrlToFile(nextPreviewUrl, 'image-input'));
        }
        if (nextPreviewUrl2.startsWith('data:')) {
            setImageFile2(await dataUrlToFile(nextPreviewUrl2, 'image-input-2'));
        }
    }, []);

    const { switchModel, hasRestoredDraftRef } = useImageCreateDraftPersistence({
        defaultModelId: DEFAULT_IMAGE_MODEL,
        selectedModel,
        setSelectedModel,
        snapshot: currentSnapshot,
        applySnapshot,
    });

    useEffect(() => {
        try {
            const storedInstruction = localStorage.getItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY);
            if (storedInstruction !== null) {
                setPromptHelperInstruction(storedInstruction);
            }
        } catch (error) {
            console.warn('Failed to restore prompt helper instruction', error);
        }
    }, []);

    useEffect(() => {
        try {
            if (promptHelperInstruction.trim()) {
                localStorage.setItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY, promptHelperInstruction);
            } else {
                localStorage.removeItem(PROMPT_HELPER_INSTRUCTION_STORAGE_KEY);
            }
        } catch (error) {
            console.warn('Failed to persist prompt helper instruction', error);
        }
    }, [promptHelperInstruction]);

    // Keep selected model valid after draft hydration, but do not override store-restored reuse targets.
    useEffect(() => {
        if (!hasRestoredDraftRef.current) {
            return;
        }

        const isImageModel = imageModels.some(m => m.id === selectedModel);
        if (!selectedModel || !isImageModel) {
            if (imageModels.length > 0) {
                setSelectedModel(imageModels[0].id);
            }
        }
    }, [hasRestoredDraftRef, imageModels, selectedModel]);

    const currentModel = getModelById(selectedModel || '') || imageModels[0];
    const isZImageModel = currentModel?.id === 'z-image';
    const zImageLoraParams = useMemo(() => {
        if (!isZImageModel || !currentModel) return [];
        return currentModel.parameters.filter((param) => param.type === 'lora-selector');
    }, [currentModel, isZImageModel]);
    const zImageLoraWeightByName = useMemo(() => {
        const map: Record<string, string> = {};
        if (!isZImageModel || !currentModel) return map;
        currentModel.parameters
            .filter((param) => /^loraWeight\d*$/.test(param.name))
            .forEach((param) => {
                const suffix = param.name.replace('loraWeight', '');
                const loraName = suffix ? `lora${suffix}` : 'lora';
                map[loraName] = param.name;
            });
        return map;
    }, [currentModel, isZImageModel]);
    const selectedZImageLoraSlots = useMemo(() => {
        return zImageLoraParams
            .map((param) => {
                const path = String(parameterValues[param.name] ?? '').trim();
                if (!path) return null;
                const matchedLoRA = availableLoras.find((lora) => lora.s3Path === path);
                const weightParamName = zImageLoraWeightByName[param.name];
                const rawWeight = weightParamName ? parameterValues[weightParamName] : undefined;
                const weight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight ?? 1);
                return {
                    param,
                    path,
                    matchedLoRA,
                    weightParamName,
                    weight: Number.isFinite(weight) ? weight : 1,
                };
            })
            .filter((slot): slot is NonNullable<typeof slot> => slot !== null);
    }, [availableLoras, parameterValues, zImageLoraParams, zImageLoraWeightByName]);
    const nextEmptyZImageLoraParam = useMemo(() => {
        return zImageLoraParams.find((param) => !String(parameterValues[param.name] ?? '').trim()) ?? null;
    }, [parameterValues, zImageLoraParams]);
    const promptHelperProvider = settings.promptHelper?.provider || 'disabled';
    const isPromptHelperConfigured = promptHelperProvider === 'local'
        && !!settings.promptHelper?.local?.baseUrl?.trim()
        && !!settings.promptHelper?.local?.model?.trim();
    const visionPromptHelperProvider = settings.visionPromptHelper?.provider || 'disabled';
    const isVisionPromptHelperConfigured = visionPromptHelperProvider === 'local'
        && !!settings.visionPromptHelper?.local?.baseUrl?.trim()
        && !!settings.visionPromptHelper?.local?.model?.trim();

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
    const isPromptDraftSelected = selectedPromptDocumentId.trim().length > 0;

    const loadPromptDocumentForCreate = React.useCallback(async (documentId: string) => {
        const response = await fetch(`/api/prompt-documents/${documentId}`, { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok || !data?.success || !data?.document) {
            throw new Error(data?.error || 'Failed to load prompt draft');
        }

        return data.document as PromptDocument;
    }, []);

    const loadCharactersForPromptDraft = React.useCallback(async () => {
        const response = await fetch('/api/characters', { cache: 'no-store' });
        const data = await response.json();

        if (!response.ok || !data?.success) {
            throw new Error(data?.error || 'Failed to load characters');
        }

        return (Array.isArray(data.characters) ? data.characters : []) as CharacterSummary[];
    }, []);

    const syncSelectedPromptDraft = React.useCallback(async (documentId: string) => {
        const document = await loadPromptDocumentForCreate(documentId);
        const characters = documentUsesRandomCharacterAppearance(document) ? await loadCharactersForPromptDraft() : [];
        const rendered = renderPromptDocumentForCreate(document, characters);

        setSelectedPromptDocumentTitle(document.title || '');
        setPrompt(rendered.renderedPrompt || '');
        setSceneSnapshot(rendered.sceneSnapshot);

        return {
            document,
            renderedPrompt: rendered.renderedPrompt,
            sceneSnapshot: rendered.sceneSnapshot,
        };
    }, [loadCharactersForPromptDraft, loadPromptDocumentForCreate]);

    useEffect(() => {
        let cancelled = false;

        const loadPromptDocuments = async () => {
            if (!activeWorkspaceId) {
                setPromptDocuments([]);
                return;
            }

            setIsPromptDocumentsLoading(true);
            try {
                const params = new URLSearchParams({ workspaceId: activeWorkspaceId });
                const response = await fetch(`/api/prompt-documents?${params.toString()}`, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok || !data?.success) {
                    throw new Error(data?.error || 'Failed to load prompt drafts');
                }

                if (!cancelled) {
                    setPromptDocuments(Array.isArray(data.documents) ? data.documents : []);
                }
            } catch (error) {
                if (!cancelled) {
                    setPromptDocuments([]);
                    console.warn('Failed to load prompt drafts for Image Create:', error);
                }
            } finally {
                if (!cancelled) {
                    setIsPromptDocumentsLoading(false);
                }
            }
        };

        void loadPromptDocuments();
        return () => {
            cancelled = true;
        };
    }, [activeWorkspaceId]);

    useEffect(() => {
        if (!selectedPromptDocumentId) return;
        let cancelled = false;

        const sync = async () => {
            setIsPromptDraftSyncing(true);
            try {
                await syncSelectedPromptDraft(selectedPromptDocumentId);
            } catch (error) {
                if (!cancelled) {
                    setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to sync prompt draft' });
                }
            } finally {
                if (!cancelled) {
                    setIsPromptDraftSyncing(false);
                }
            }
        };

        void sync();
        return () => {
            cancelled = true;
        };
    }, [selectedPromptDocumentId, syncSelectedPromptDraft]);

    useEffect(() => {
        if (!selectedPromptDocumentId || selectedPromptDocumentTitle.trim()) return;
        const summary = promptDocuments.find((entry) => entry.id === selectedPromptDocumentId);
        if (summary?.title) {
            setSelectedPromptDocumentTitle(summary.title);
        }
    }, [promptDocuments, selectedPromptDocumentId, selectedPromptDocumentTitle]);

    const submitPromptHelper = async ({
        instructionOverride,
        openOnError = false,
        closeOnSuccess = true,
        animatePromptOnSuccess = false,
    }: {
        instructionOverride?: string;
        openOnError?: boolean;
        closeOnSuccess?: boolean;
        animatePromptOnSuccess?: boolean;
    } = {}) => {
        const instruction = (instructionOverride ?? promptHelperInstruction).trim();

        if (!instruction || isPromptHelperLoading) {
            return;
        }

        setPromptHelperError(null);
        setPromptHelperDebug(null);
        setIsPromptHelperLoading(true);

        try {
            const data = await requestImagePromptImprovement({
                prompt,
                negativePrompt: currentNegativePrompt,
                instruction,
                modelId: currentModel.id,
                width: Number.isFinite(currentWidth) ? currentWidth : undefined,
                height: Number.isFinite(currentHeight) ? currentHeight : undefined,
            });

            setPrompt(data.improvedPrompt);

            if (promptHelperChangeNegative && negativePromptParameterName && typeof data.improvedNegativePrompt === 'string') {
                setParameterValues((prev) => ({
                    ...prev,
                    [negativePromptParameterName]: data.improvedNegativePrompt,
                }));
            }

            if (animatePromptOnSuccess) {
                setIsPromptHelperQuickAnimating(true);
                window.setTimeout(() => setIsPromptHelperQuickAnimating(false), 1200);
            }

            setPromptHelperError(null);
            setPromptHelperDebug(null);
            if (closeOnSuccess) {
                setIsPromptHelperOpen(false);
            }
        } catch (error) {
            setPromptHelperError(error instanceof Error ? error.message : 'Prompt Helper request failed');
            const debug = (error as Error & { debug?: { content?: string; reasoningContent?: string } }).debug;
            setPromptHelperDebug(debug || null);
            if (openOnError) {
                setIsPromptHelperOpen(true);
            }
        } finally {
            setIsPromptHelperLoading(false);
        }
    };

    const runSavedPromptHelperInstruction = async () => {
        if (!promptHelperInstruction.trim() || isPromptHelperLoading || isVisionPromptLoading) {
            return;
        }

        await submitPromptHelper({
            instructionOverride: promptHelperInstruction,
            openOnError: true,
            closeOnSuccess: false,
            animatePromptOnSuccess: true,
        });
    };

    const readFileAsDataUrl = async (file: File) => {
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to read image as data URL'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
        });
    };

    const replaceImagePromptFile = (file: File) => {
        setImagePromptFile(file);
        setImagePromptPreviewUrl((prev) => {
            if (prev) {
                URL.revokeObjectURL(prev);
            }
            return URL.createObjectURL(file);
        });
        setImagePromptResult('');
        setHasCopiedImagePromptResult(false);
    };

    const extractPromptFromImage = async () => {
        if (!imagePromptFile || isVisionPromptLoading) {
            return;
        }

        const startedAt = Date.now();
        setImagePromptResult('');
        setHasCopiedImagePromptResult(false);
        setImagePromptElapsedMs(0);
        setImagePromptStartedAt(startedAt);
        setIsVisionPromptLoading(true);

        try {
            const imageDataUrl = await readFileAsDataUrl(imagePromptFile);
            const extractedPrompt = await extractImagePromptFromDataUrl({
                imageDataUrl,
                modelId: currentModel.id,
                instruction: 'Return one concise reusable image-generation prompt in English. Preserve fine visible details like hair, face, clothing construction, accessories, pose, body orientation, framing, camera angle, and photographic style cues. Do not guess hidden details.',
            });

            setImagePromptResult(extractedPrompt);
        } catch (error) {
            setImagePromptResult(error instanceof Error ? error.message : 'Image to prompt extraction failed');
        } finally {
            setImagePromptElapsedMs(Date.now() - startedAt);
            setImagePromptStartedAt(null);
            setIsVisionPromptLoading(false);
        }
    };

    const handleImagePromptFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            replaceImagePromptFile(file);
        }
        event.target.value = '';
    };

    const handleImagePromptPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
        if (isVisionPromptLoading) {
            event.preventDefault();
            return;
        }

        const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
        if (!imageItem) {
            return;
        }

        const file = imageItem.getAsFile();
        if (!file) {
            return;
        }

        event.preventDefault();
        replaceImagePromptFile(file);
    };

    const closeImagePromptDialog = () => {
        if (isVisionPromptLoading) {
            return;
        }

        if (imagePromptPreviewUrl) {
            URL.revokeObjectURL(imagePromptPreviewUrl);
        }

        setImagePromptFile(null);
        setImagePromptPreviewUrl('');
        setImagePromptResult('');
        setHasCopiedImagePromptResult(false);
        setImagePromptElapsedMs(0);
        setImagePromptStartedAt(null);
        setIsImagePromptOpen(false);
    };

    useEffect(() => {
        if (!isVisionPromptLoading || imagePromptStartedAt === null) {
            return;
        }

        setImagePromptElapsedMs(Date.now() - imagePromptStartedAt);
        const intervalId = window.setInterval(() => {
            setImagePromptElapsedMs(Date.now() - imagePromptStartedAt);
        }, 100);

        return () => window.clearInterval(intervalId);
    }, [isVisionPromptLoading, imagePromptStartedAt]);

    const formatElapsedMs = (elapsedMs: number) => {
        const totalSeconds = elapsedMs / 1000;
        if (totalSeconds < 60) {
            return `${totalSeconds.toFixed(1)}s`;
        }

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
    };

    const copyImagePromptResult = async () => {
        if (!imagePromptResult.trim() || isVisionPromptLoading) {
            return;
        }

        await navigator.clipboard.writeText(imagePromptResult);
        setHasCopiedImagePromptResult(true);
        closeImagePromptDialog();
    };

    const isSubmitShortcut = (event: KeyboardEvent | React.KeyboardEvent) => {
        return (event.ctrlKey || event.metaKey) && event.key === 'Enter';
    };

    // Check if current model has LoRA parameters
    const hasLoRAParameter = (model: typeof currentModel) => {
        return model?.parameters.some(param => param.type === 'lora-selector');
    };

    // Fetch available LoRAs
    const fetchAvailableLoras = async () => {
        if (!activeWorkspaceId) return;

        setIsLoadingLoras(true);
        try {
            const response = await fetch(`/api/lora?workspaceId=${activeWorkspaceId}`);
            const data = await response.json();

            if (data.success && data.loras) {
                setAvailableLoras(data.loras);
                if (currentModel && hasLoRAParameter(currentModel)) {
                    const sanitized = sanitizeHydratedLoraParameterValues(
                        currentModel.id,
                        parameterValues,
                        data.loras.map((lora: LoRAFile) => lora.s3Path),
                    );
                    if (sanitized.changed) {
                        setParameterValues(sanitized.parameterValues || {});
                    }
                }
            } else {
                console.error('Failed to fetch LoRAs:', data.error);
                setAvailableLoras([]);
            }
        } catch (error) {
            console.error('Error fetching LoRAs:', error);
            setAvailableLoras([]);
        } finally {
            setIsLoadingLoras(false);
        }
    };

    const getLorasForReuse = async (): Promise<LoRAFile[]> => {
        if (availableLoras.length > 0) {
            return availableLoras;
        }

        if (!activeWorkspaceId) {
            return [];
        }

        try {
            const response = await fetch(`/api/lora?workspaceId=${activeWorkspaceId}`);
            const data = await response.json();
            if (data.success && Array.isArray(data.loras)) {
                setAvailableLoras(data.loras);
                return data.loras;
            }
        } catch (error) {
            console.error('Error fetching LoRAs for reuse:', error);
        }

        return [];
    };

    // Fetch LoRAs when model changes or dialog closes
    useEffect(() => {
        if (currentModel && hasLoRAParameter(currentModel)) {
            fetchAvailableLoras();
        }
    }, [currentModel, showLoRADialog, activeWorkspaceId]);


    // Handler for parameter changes
    const handleParameterChange = (paramName: string, value: any) => {
        setParameterValues(prev => ({
            ...prev,
            [paramName]: value
        }));
    };

    const handleNumericParameterInput = (paramName: string, rawValue: string) => {
        if (/^loraWeight\d*$/.test(paramName)) {
            if (/^-?\d*(\.\d*)?$/.test(rawValue)) {
                handleParameterChange(paramName, rawValue);
            }
            return;
        }

        handleParameterChange(paramName, parseFloat(rawValue));
    };

    const swapDimensionParameters = (widthParam: any, heightParam: any) => {
        const currentWidth = parameterValues[widthParam.name] ?? widthParam.default;
        const currentHeight = parameterValues[heightParam.name] ?? heightParam.default;

        setParameterValues(prev => ({
            ...prev,
            [widthParam.name]: currentHeight,
            [heightParam.name]: currentWidth,
        }));

        setIsDimensionSwapHighlightActive(true);
        window.setTimeout(() => setIsDimensionSwapHighlightActive(false), 650);
    };

    const applyAspectPreset = (widthParam: any, heightParam: any, ratioWidth: number, ratioHeight: number) => {
        const currentWidth = Number(parameterValues[widthParam.name] ?? widthParam.default);
        const currentHeight = Number(parameterValues[heightParam.name] ?? heightParam.default);
        const baseEdge = Math.max(64, Math.round(Math.max(currentWidth || 0, currentHeight || 0, 1024)));

        let nextWidth = baseEdge;
        let nextHeight = baseEdge;

        if (ratioWidth >= ratioHeight) {
            nextHeight = Math.round((baseEdge * ratioHeight) / ratioWidth);
        } else {
            nextWidth = Math.round((baseEdge * ratioWidth) / ratioHeight);
        }

        const clampToStep = (value: number, step?: number) => {
            const safeStep = Number(step || 64);
            return Math.max(safeStep, Math.round(value / safeStep) * safeStep);
        };

        setParameterValues(prev => ({
            ...prev,
            [widthParam.name]: clampToStep(nextWidth, widthParam.step),
            [heightParam.name]: clampToStep(nextHeight, heightParam.step),
        }));
    };

    const renderDimensionPair = (params: any[]) => {
        const widthParam = params.find(param => param.name === 'width');
        const heightParam = params.find(param => param.name === 'height');

        if (!widthParam || !heightParam || !isParameterVisible(widthParam) || !isParameterVisible(heightParam)) {
            return null;
        }

        return (
            <div className="space-y-2">
                {isPhoneLayout && (
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['1:1', 1, 1],
                            ['3:4', 3, 4],
                            ['4:3', 4, 3],
                            ['9:16', 9, 16],
                            ['16:9', 16, 9],
                        ].map(([label, rw, rh]) => (
                            <button
                                key={label}
                                type="button"
                                onClick={() => applyAspectPreset(widthParam, heightParam, Number(rw), Number(rh))}
                                className="rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs text-foreground hover:bg-muted/40"
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs">Width × Height</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => swapDimensionParameters(widthParam, heightParam)}
                        title="Swap width and height"
                        aria-label="Swap width and height"
                    >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <div className="space-y-2">
                        <Label className="text-xs">{widthParam.label}</Label>
                        <Input
                            type="number"
                            name={widthParam.name}
                            value={parameterValues[widthParam.name] ?? widthParam.default}
                            onChange={(e) => handleParameterChange(widthParam.name, parseFloat(e.target.value))}
                            min={widthParam.min}
                            max={widthParam.max}
                            step={widthParam.step}
                            className={`h-8 text-sm transition-all duration-500 ${isDimensionSwapHighlightActive ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : ''}`}
                        />
                    </div>
                    <div className="pb-2 text-xs text-muted-foreground">×</div>
                    <div className="space-y-2">
                        <Label className="text-xs">{heightParam.label}</Label>
                        <Input
                            type="number"
                            name={heightParam.name}
                            value={parameterValues[heightParam.name] ?? heightParam.default}
                            onChange={(e) => handleParameterChange(heightParam.name, parseFloat(e.target.value))}
                            min={heightParam.min}
                            max={heightParam.max}
                            step={heightParam.step}
                            className={`h-8 text-sm transition-all duration-500 ${isDimensionSwapHighlightActive ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : ''}`}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // Check if a parameter should be visible based on dependsOn
    const isParameterVisible = (param: any) => {
        if (!param.dependsOn) return true;
        const dependentValue = parameterValues[param.dependsOn.parameter];
        return dependentValue === param.dependsOn.value;
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);

            // Auto-set dimensions in React state so draft persistence sees them
            const img = new Image();
            img.onload = () => {
                setParameterValues(prev => ({
                    ...prev,
                    width: img.width,
                    height: img.height,
                }));
                console.log('✅ Auto-set image dimensions:', img.width, 'x', img.height);
            };
            img.src = url;
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            const data = e.dataTransfer.getData('application/json');
            if (data) {
                const mediaData = JSON.parse(data);
                if (mediaData.type === 'image' && mediaData.url) {
                    // Fetch the image from workspace and convert to File
                    const response = await fetch(mediaData.url);
                    const blob = await response.blob();
                    const file = new File([blob], `workspace-${mediaData.id}.png`, { type: 'image/png' });

                    setImageFile(file);
                    setPreviewUrl(mediaData.url);

                    // Auto-set dimensions
                    const img = new Image();
                    img.onload = () => {
                        setParameterValues(prev => ({
                            ...prev,
                            width: img.width,
                            height: img.height,
                        }));
                    };
                    img.src = mediaData.url;
                }
            }
        } catch (error) {
            console.error('Error handling drop:', error);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleImageUpload2 = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile2(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl2(url);
        }
    };

    const handleDrop2 = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        try {
            const data = e.dataTransfer.getData('application/json');
            if (data) {
                const mediaData = JSON.parse(data);
                if (mediaData.type === 'image' && mediaData.url) {
                    // Fetch the image from workspace and convert to File
                    const response = await fetch(mediaData.url);
                    const blob = await response.blob();
                    const file = new File([blob], `workspace-${mediaData.id}.png`, { type: 'image/png' });

                    setImageFile2(file);
                    setPreviewUrl2(mediaData.url);
                }
            }
        } catch (error) {
            console.error('Error handling drop 2:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (currentModel.inputs.includes('text') && !prompt && !isPromptDraftSelected) {
            return;
        }

        setIsGenerating(true);

        const form = e.target as HTMLFormElement;
        const dimInput = form.elements.namedItem('dimensions') as HTMLSelectElement | null;

        let promptForSubmit = prompt;
        let sceneSnapshotForSubmit = sceneSnapshot;
        let sourcePromptDocumentIdForSubmit = selectedPromptDocumentId || null;
        let sourcePromptDocumentTitleForSubmit = selectedPromptDocumentTitle || null;

        if (isPromptDraftSelected) {
            try {
                setIsPromptDraftSyncing(true);
                const synced = await syncSelectedPromptDraft(selectedPromptDocumentId);
                promptForSubmit = synced.renderedPrompt;
                sceneSnapshotForSubmit = synced.sceneSnapshot;
                sourcePromptDocumentIdForSubmit = synced.document.id;
                sourcePromptDocumentTitleForSubmit = synced.document.title;
            } catch (error) {
                setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to sync prompt draft' });
                setIsGenerating(false);
                setIsPromptDraftSyncing(false);
                return;
            }
            setIsPromptDraftSyncing(false);
        }

        const result = await submitImageGeneration({
            currentModel,
            prompt: promptForSubmit,
            parameterValues,
            randomizeSeed,
            activeWorkspaceId,
            settings,
            imageFile,
            imageFile2,
            imagePreviewUrl: previewUrl,
            imagePreviewUrl2: previewUrl2,
            dimensions: dimInput?.value || null,
            sceneSnapshot: sceneSnapshotForSubmit,
            sourcePromptDocumentId: sourcePromptDocumentIdForSubmit,
            sourcePromptDocumentTitle: sourcePromptDocumentTitleForSubmit,
        });

        if (result.success) {
            addJob(result.job);
        } else {
            setMessage({ type: 'error', text: result.error });
        }

        if (result.nextSeed !== null) {
            setParameterValues(prev => ({
                ...prev,
                seed: result.nextSeed,
            }));
        }

        setIsGenerating(false);
    };


    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!isSubmitShortcut(event)) return;

            if (isPromptHelperOpen) {
                event.preventDefault();
                void submitPromptHelper();
                return;
            }

            if (isGenerating) return;
            if (!formElementRef.current) return;

            // Global shortcut: submit even when focus is outside the form.
            event.preventDefault();
            formElementRef.current.requestSubmit();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isGenerating, isPromptHelperOpen, promptHelperInstruction, isPromptHelperLoading, prompt, currentModel.id, currentNegativePrompt, negativePromptParameterName]);

    if (!currentModel) return <div>{t('generationForm.loading')}</div>;

    return (
        <div ref={formRef} className="space-y-4 pb-20">
            {/* Success Toast */}
            {showReuseSuccess && (
                <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
                    <div className="bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-medium">{t('generationForm.inputReusedSuccess')}</span>
                    </div>
                </div>
            )}

            {/* Model Selector Card */}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t('generationForm.using')}</Label>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="w-full bg-muted/30 border border-border hover:border-primary/50 rounded-lg px-3 py-2.5 flex items-center justify-between transition-all duration-200"
                    >
                        <span className="text-sm font-semibold text-foreground">{currentModel.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground uppercase">{currentModel.provider}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`}>
                                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </button>

                    {isModelDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsModelDropdownOpen(false)} />
                            <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-zinc-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="py-1 max-h-64 overflow-y-auto">
                                    {imageModels.map(model => (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => {
                                                void switchModel(model.id, currentSnapshot);
                                                setIsModelDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 transition-colors ${selectedModel === model.id
                                                ? 'bg-primary/15 text-foreground'
                                                : 'hover:bg-muted/50 text-foreground/80'
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{model.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="px-1.5 py-0.5 bg-muted/50 rounded text-[10px] font-mono text-muted-foreground uppercase">{model.provider}</span>
                                                {selectedModel === model.id && (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-primary">
                                                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <form ref={formElementRef} onSubmit={handleSubmit} className="space-y-4">
                {/* Image Upload - conditionalInputs 기반으로 표시 */}
                {isInputVisible(currentModel, 'image', parameterValues) && (
                    <div className="space-y-2">
                        <Label className="text-xs">
                            Input Image {currentModel.optionalInputs?.includes('image') ? '(Optional)' : '(Required)'}
                        </Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                        />
                        <div
                            className="w-full p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                            onClick={() => !isLoadingMedia && fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                        >
                            {isLoadingMedia ? (
                                <div className="text-center text-muted-foreground">
                                    <div className="w-8 h-8 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    <p className="text-xs">Loading media file...</p>
                                </div>
                            ) : previewUrl ? (
                                <div className="space-y-2">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="max-w-full max-h-48 mx-auto rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewUrl('');
                                            setImageFile(null);
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <PhotoIcon className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-xs">Click to upload image</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Second Image Upload - Specific to Models with imageInput2Key */}
                {isInputVisible(currentModel, 'image2', parameterValues) && (
                    <div className="space-y-2">
                        <Label className="text-xs">
                            Second Image {currentModel.optionalInputs?.includes('image2') ? '(Optional)' : '(Required)'}
                        </Label>
                        <input
                            ref={fileInputRef2}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload2}
                            className="hidden"
                        />
                        <div
                            className="w-full p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                            onClick={() => !isLoadingMedia && fileInputRef2.current?.click()}
                            onDrop={handleDrop2}
                            onDragOver={handleDragOver}
                        >
                            {isLoadingMedia ? (
                                <div className="text-center text-muted-foreground">
                                    <div className="w-8 h-8 mx-auto mb-2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    <p className="text-xs">Loading media file...</p>
                                </div>
                            ) : previewUrl2 ? (
                                <div className="space-y-2">
                                    <img
                                        src={previewUrl2}
                                        alt="Preview 2"
                                        className="max-w-full max-h-48 mx-auto rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewUrl2('');
                                            setImageFile2(null);
                                        }}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <PhotoIcon className="w-8 h-8 mx-auto mb-2" />
                                    <p className="text-xs">Click to upload second image (optional)</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Prompt - only show if model accepts text input */}
                {currentModel.inputs.includes('text') && (
                    <div className="space-y-3">
                        {!isPhoneLayout && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Prompt draft</Label>
                                <select
                                    className="h-10 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                    value={selectedPromptDocumentId}
                                    onChange={(event) => {
                                        const nextId = event.target.value;
                                        if (!nextId) {
                                            setSelectedPromptDocumentId('');
                                            setSelectedPromptDocumentTitle('');
                                            setSceneSnapshot(null);
                                            return;
                                        }
                                        const summary = promptDocuments.find((entry) => entry.id === nextId);
                                        setSelectedPromptDocumentId(nextId);
                                        setSelectedPromptDocumentTitle(summary?.title || '');
                                    }}
                                    disabled={isPromptDocumentsLoading || isGenerating}
                                    data-testid="image-create-prompt-draft-selector"
                                >
                                    <option value="">Manual prompt</option>
                                    {promptDocuments.map((document) => (
                                        <option key={document.id} value={document.id}>
                                            {document.title}
                                        </option>
                                    ))}
                                </select>
                                <div className="text-[11px] text-muted-foreground">
                                    {isPromptDraftSelected
                                        ? 'Prompt is synced from the selected draft on every generate.'
                                        : 'Select a saved Prompt Constructor draft to lock prompt editing.'}
                                </div>
                            </div>
                        )}
                        <div className="relative">
                            <textarea
                                className={`w-full min-h-[120px] p-3 rounded-lg border text-base md:text-sm resize-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/50 ${isPromptHelperQuickAnimating ? 'border-primary bg-primary/5 shadow-[0_0_0_1px_rgba(59,130,246,0.35)]' : 'border-border bg-secondary/50'} ${(isPromptHelperLoading || isPromptDraftSyncing || isPromptDraftSelected) ? 'opacity-70 cursor-not-allowed' : ''}`}
                                placeholder={t('generationForm.describeYourImage')}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isPromptHelperLoading || isPromptDraftSyncing || isPromptDraftSelected}
                                data-testid="image-create-prompt-textarea"
                            />
                        </div>
                        <div className={`grid grid-cols-1 gap-2 ${isPhoneLayout ? '' : 'sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]'}`}>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setPromptHelperError(null);
                                    setIsPromptHelperOpen(true);
                                }}
                                disabled={!isPromptHelperConfigured || isPromptHelperLoading || isVisionPromptLoading || isPromptDraftSelected || isPromptDraftSyncing}
                                className="w-full justify-center gap-2"
                            >
                                {isPromptHelperLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Prompt Helper is working...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="h-4 w-4" />
                                        Prompt Helper
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => void runSavedPromptHelperInstruction()}
                                disabled={!isPromptHelperConfigured || !promptHelperInstruction.trim() || isPromptHelperLoading || isVisionPromptLoading || isPromptDraftSelected || isPromptDraftSyncing}
                                className={isPhoneLayout ? 'h-11 w-full shrink-0' : 'h-10 w-10 shrink-0'}
                                title={promptHelperInstruction.trim() ? 'Apply saved Prompt Helper instruction' : 'Save a Prompt Helper instruction first'}
                            >
                                {isPromptHelperLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsImagePromptOpen(true);
                                    setImagePromptResult('');
                                    setHasCopiedImagePromptResult(false);
                                }}
                                disabled={!isVisionPromptHelperConfigured || isVisionPromptLoading || isPromptHelperLoading || isPromptDraftSelected || isPromptDraftSyncing}
                                className="w-full justify-center gap-2"
                            >
                                <ImagePlus className="h-4 w-4" />
                                Image → Prompt
                            </Button>
                        </div>
                    </div>
                )}

                {/* Basic Parameters */}
                {renderDimensionPair(currentModel.parameters.filter(p => p.group === 'basic'))}
                {currentModel.parameters.filter(p => p.group === 'basic' && isParameterVisible(p) && p.name !== 'width' && p.name !== 'height').map(param => (
                    <div key={`${param.name}-${param.default}`} className="space-y-2">
                        {param.type !== 'boolean' && <Label className="text-xs">{param.label}</Label>}
                        {param.type === 'boolean' ? (
                            <div
                                className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                                onClick={() => handleParameterChange(param.name, !(parameterValues[param.name] ?? param.default))}
                            >
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm font-medium text-foreground">{param.label}</span>
                                    {param.description && (
                                        <span className="text-xs text-muted-foreground">{param.description}</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={parameterValues[param.name] ?? param.default}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${(parameterValues[param.name] ?? param.default) ? 'bg-primary' : 'bg-muted'
                                        }`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleParameterChange(param.name, !(parameterValues[param.name] ?? param.default));
                                    }}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${(parameterValues[param.name] ?? param.default) ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                    />
                                </button>
                            </div>
                        ) : param.type === 'select' ? (
                            <select
                                name={param.name}
                                className="w-full p-2 rounded-md border border-border bg-background text-sm"
                                value={parameterValues[param.name] ?? param.default}
                                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                            >
                                {param.options?.map(opt => (
                                    <option key={opt} value={opt} className="bg-zinc-950 text-zinc-100">{opt}</option>
                                ))}
                            </select>
                        ) : param.type === 'string' ? (
                            <Input
                                type="text"
                                name={param.name}
                                value={parameterValues[param.name] ?? param.default}
                                onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                className="h-8 text-sm"
                            />
                        ) : (
                            <Input
                                type="number"
                                name={param.name}
                                value={parameterValues[param.name] ?? param.default}
                                onChange={(e) => handleParameterChange(param.name, parseFloat(e.target.value))}
                                min={param.min}
                                max={param.max}
                                step={param.step}
                                className="h-8 text-sm"
                            />
                        )}
                    </div>
                ))}

                {/* Dimensions - Always Visible */}
                {currentModel.capabilities.dimensions && currentModel.capabilities.dimensions.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-xs">Resolution</Label>
                        <select
                            name="dimensions"
                            className="w-full p-2 rounded-md border border-border bg-background text-sm"
                        >
                            {currentModel.capabilities.dimensions.map(dim => (
                                <option key={dim} value={dim} className="bg-zinc-950 text-zinc-100">{dim}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Advanced Settings */}
                <div className="border-t border-border pt-4">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                        <span>{t('generationForm.advancedSettings')}</span>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                        >
                            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                        </svg>
                    </button>

                    <div className={`space-y-4 animate-in slide-in-from-top-2 duration-200 ${showAdvanced ? '' : 'hidden'}`}>
                        {renderDimensionPair(currentModel.parameters.filter(p => !p.group || p.group === 'advanced'))}
                        {isZImageModel && zImageLoraParams.length > 0 && (
                            <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-medium text-foreground">LoRAs</div>
                                        <div className="text-xs text-muted-foreground">Only selected LoRAs are shown here.</div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {selectedZImageLoraSlots.length}/{zImageLoraParams.length}
                                    </div>
                                </div>

                                {selectedZImageLoraSlots.length > 0 ? (
                                    <div className="space-y-3">
                                        {selectedZImageLoraSlots.map((slot) => (
                                            <div key={slot.param.name} className="rounded-lg border border-border/70 bg-background/50 p-3">
                                                <div className="mb-3 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-medium text-foreground">
                                                            {slot.matchedLoRA?.fileName || slot.path.split('/').pop() || slot.path}
                                                        </div>
                                                        <div className="mt-1 text-xs text-muted-foreground">Weight {slot.weight.toFixed(2)}</div>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => {
                                                            handleParameterChange(slot.param.name, '');
                                                            if (slot.weightParamName) {
                                                                handleParameterChange(slot.weightParamName, 1);
                                                            }
                                                        }}
                                                    >
                                                        Clear
                                                    </Button>
                                                </div>
                                                {slot.weightParamName && (
                                                    <div className="flex items-center gap-3">
                                                        <Input
                                                            type="number"
                                                            value={slot.weight}
                                                            min={-5}
                                                            max={5}
                                                            step={0.1}
                                                            className="h-8 w-32 text-sm"
                                                            onChange={(e) => handleParameterChange(slot.weightParamName, parseFloat(e.target.value))}
                                                        />
                                                        <span className="text-xs text-muted-foreground">Adjust LoRA weight</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                                        No LoRAs selected yet.
                                    </div>
                                )}

                                {nextEmptyZImageLoraParam && (
                                    <Button type="button" variant="outline" className="w-full" onClick={() => setShowDesktopLoraSelector(true)}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add LoRA
                                    </Button>
                                )}
                            </div>
                        )}
                        {currentModel.parameters.filter(p => (!p.group || p.group === 'advanced') && isParameterVisible(p) && p.name !== 'width' && p.name !== 'height' && !(isZImageModel && (p.type === 'lora-selector' || /^loraWeight\d*$/.test(p.name)))).map(param => (
                            <div key={`${param.name}-${param.default}`} className="space-y-2">
                                {param.type !== 'boolean' && param.type !== 'lora-selector' && <Label className="text-xs">{param.label}</Label>}
                                {param.type === 'lora-selector' ? (
                                    <LoRASelector
                                        value={parameterValues[param.name] || ''}
                                        onChange={(value) => handleParameterChange(param.name, value)}
                                        label={param.label}
                                        description={param.description}
                                        availableLoras={availableLoras}
                                        onManageClick={() => setShowLoRADialog(true)}
                                    />
                                ) : param.type === 'boolean' ? (
                                    <div
                                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                                        onClick={() => handleParameterChange(param.name, !(parameterValues[param.name] ?? param.default))}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium text-foreground">{param.label}</span>
                                            {param.description && (
                                                <span className="text-xs text-muted-foreground">{param.description}</span>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={parameterValues[param.name] ?? param.default}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${(parameterValues[param.name] ?? param.default) ? 'bg-primary' : 'bg-muted'
                                                }`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleParameterChange(param.name, !(parameterValues[param.name] ?? param.default));
                                            }}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${(parameterValues[param.name] ?? param.default) ? 'translate-x-5' : 'translate-x-0'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                ) : param.type === 'select' ? (
                                    <select
                                        name={param.name}
                                        className="w-full p-2 rounded-md border border-border bg-background text-sm"
                                        value={parameterValues[param.name] ?? param.default}
                                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                    >
                                        {param.options?.map(opt => (
                                            <option key={opt} value={opt} className="bg-zinc-950 text-zinc-100">{opt}</option>
                                        ))}
                                    </select>
                                ) : param.type === 'string' ? (
                                    <Input
                                        type="text"
                                        name={param.name}
                                        value={parameterValues[param.name] ?? param.default}
                                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                ) : (
                                    <>
                                        <Input
                                            type={/^loraWeight\d*$/.test(param.name) ? 'text' : 'number'}
                                            inputMode={/^loraWeight\d*$/.test(param.name) ? 'text' : undefined}
                                            name={param.name}
                                            value={parameterValues[param.name] ?? param.default}
                                            onChange={(e) => handleNumericParameterInput(param.name, e.target.value)}
                                            min={/^loraWeight\d*$/.test(param.name) ? undefined : param.min}
                                            max={/^loraWeight\d*$/.test(param.name) ? undefined : param.max}
                                            step={/^loraWeight\d*$/.test(param.name) ? undefined : param.step}
                                            className="h-8 text-sm"
                                        />
                                        {param.name === 'seed' && (
                                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={randomizeSeed}
                                                    onChange={(e) => setRandomizeSeed(e.target.checked)}
                                                    className="h-3.5 w-3.5 rounded border-border"
                                                />
                                                Randomize
                                            </label>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="pt-2">
                    {message && (
                        <div className={`p-3 rounded-md text-sm mb-2 ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            {message.text}
                        </div>
                    )}
                    <Button
                        type="submit"
                        disabled={isGenerating || isLoadingMedia || isPromptDraftSyncing}
                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-2.5"
                    >
                        {isLoadingMedia ? t('generationForm.loadingMedia') : isGenerating ? t('generationForm.generating') : isPromptDraftSyncing ? 'Syncing prompt draft...' : t('generationForm.generate')}
                    </Button>
                </div>
            </form >

            {/* LoRA Management Dialog */}
            <Dialog
                open={isPromptHelperOpen}
                onOpenChange={(open) => {
                    setIsPromptHelperOpen(open);
                    if (!open) {
                        setPromptHelperError(null);
                        setPromptHelperDebug(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Prompt Helper</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 overflow-y-auto pr-1">
                        <Label htmlFor="prompt-helper-instruction">Instruction</Label>
                        <textarea
                            id="prompt-helper-instruction"
                            className="w-full min-h-[140px] p-3 rounded-lg border border-border bg-secondary/50 text-base md:text-sm resize-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/50"
                            placeholder="Describe how to improve or generate the prompt"
                            value={promptHelperInstruction}
                            onChange={(e) => setPromptHelperInstruction(e.target.value)}
                        />
                        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
                            <div>
                                <div className="text-sm font-medium">Change negative</div>
                                <div className="text-xs text-muted-foreground">If enabled, apply the negative prompt returned by the model.</div>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={promptHelperChangeNegative}
                                onClick={() => setPromptHelperChangeNegative((prev) => !prev)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${promptHelperChangeNegative ? 'bg-primary' : 'bg-muted'}`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${promptHelperChangeNegative ? 'translate-x-5' : 'translate-x-0'}`}
                                />
                            </button>
                        </div>
                        {promptHelperError && (
                            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400 space-y-3">
                                <div>{promptHelperError}</div>
                                {promptHelperDebug && (
                                    <div className="grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-md border border-border bg-background/60 p-3">
                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">content</div>
                                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">{promptHelperDebug.content || '(empty)'}</pre>
                                        </div>
                                        <div className="rounded-md border border-border bg-background/60 p-3">
                                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">reasoning_content</div>
                                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">{promptHelperDebug.reasoningContent || '(empty)'}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsPromptHelperOpen(false)} disabled={isPromptHelperLoading}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={() => void submitPromptHelper()}
                            disabled={isPromptHelperLoading || !promptHelperInstruction.trim() || !isPromptHelperConfigured}
                            className="gap-2"
                        >
                            {isPromptHelperLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isPromptHelperLoading ? 'Applying...' : 'Apply'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={isImagePromptOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        closeImagePromptDialog();
                        return;
                    }
                    setIsImagePromptOpen(true);
                }}
            >
                <DialogContent
                    className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
                    onEscapeKeyDown={(event) => {
                        if (isVisionPromptLoading) {
                            event.preventDefault();
                        }
                    }}
                    onPointerDownOutside={(event) => {
                        if (isVisionPromptLoading) {
                            event.preventDefault();
                        }
                    }}
                    onInteractOutside={(event) => {
                        if (isVisionPromptLoading) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Image → Prompt</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 overflow-y-auto pr-1 md:grid-cols-[1fr_1.2fr]" onPaste={handleImagePromptPaste}>
                        <div className="space-y-3">
                            <input
                                ref={imagePromptFileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleImagePromptFileChange}
                                disabled={isVisionPromptLoading}
                            />
                            <button
                                type="button"
                                onClick={() => imagePromptFileInputRef.current?.click()}
                                disabled={isVisionPromptLoading}
                                className="flex min-h-[280px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center transition hover:bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {imagePromptPreviewUrl ? (
                                    <img src={imagePromptPreviewUrl} alt="Selected image" className="max-h-[260px] w-full rounded-lg object-contain" />
                                ) : (
                                    <div className="space-y-3">
                                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary/60">
                                            <Upload className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium">Click to choose an image</div>
                                            <div className="text-xs text-muted-foreground">or press Ctrl+V to paste one from the clipboard</div>
                                        </div>
                                    </div>
                                )}
                            </button>
                            <Button
                                type="button"
                                onClick={() => void extractPromptFromImage()}
                                disabled={!imagePromptFile || isVisionPromptLoading}
                                className="w-full gap-2"
                            >
                                {isVisionPromptLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isVisionPromptLoading ? 'Extracting...' : 'Extract'}
                            </Button>
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Label>Result</Label>
                                    {(isVisionPromptLoading || imagePromptElapsedMs > 0) && (
                                        <span className="text-xs font-medium text-muted-foreground tabular-nums">
                                            {formatElapsedMs(imagePromptElapsedMs)}
                                        </span>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => void copyImagePromptResult()}
                                    disabled={!imagePromptResult.trim() || isVisionPromptLoading}
                                    title="Copy result and close"
                                >
                                    {hasCopiedImagePromptResult ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                            <textarea
                                className="min-h-[340px] w-full rounded-lg border border-border bg-secondary/30 p-3 text-base md:text-sm resize-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-80"
                                placeholder="The extracted prompt will appear here"
                                value={imagePromptResult}
                                readOnly
                                disabled={isVisionPromptLoading}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeImagePromptDialog} disabled={isVisionPromptLoading}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showDesktopLoraSelector} onOpenChange={setShowDesktopLoraSelector}>
                <DialogContent className="max-h-[80vh] max-w-lg overflow-hidden p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <DialogTitle>Select LoRA</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
                        <div className="space-y-2">
                            {isLoadingLoras ? (
                                <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">Loading LoRAs...</div>
                            ) : availableLoras.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                                    No LoRAs installed yet.
                                </div>
                            ) : (
                                availableLoras.map((lora) => (
                                    <button
                                        key={lora.id}
                                        type="button"
                                        className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-3 text-left hover:border-primary/40 hover:bg-primary/5"
                                        onClick={() => {
                                            if (!nextEmptyZImageLoraParam) return;
                                            handleParameterChange(nextEmptyZImageLoraParam.name, lora.s3Path);
                                            const weightParamName = zImageLoraWeightByName[nextEmptyZImageLoraParam.name];
                                            if (weightParamName && (parameterValues[weightParamName] === undefined || parameterValues[weightParamName] === '')) {
                                                handleParameterChange(weightParamName, 1);
                                            }
                                            setShowDesktopLoraSelector(false);
                                        }}
                                    >
                                        <div className="min-w-0 pr-3">
                                            <div className="truncate text-sm font-medium text-foreground">{lora.fileName}</div>
                                            <div className="mt-1 truncate text-xs text-muted-foreground">{lora.fileSize}</div>
                                        </div>
                                        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {showLoRADialog && (
                <LoRAManagementDialog
                    open={showLoRADialog}
                    onOpenChange={setShowLoRADialog}
                    workspaceId={activeWorkspaceId || undefined}
                    onLoRAUploaded={fetchAvailableLoras}
                />
            )}
        </div >
    );
}
