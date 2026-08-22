'use client';

import { useCallback, useEffect, useRef } from 'react';
import { CREATE_REUSE_DRAFT_EVENT, type CreateReuseDraftEventDetail } from '@/lib/create/createModeEvents';
import { getWorkflowActiveModel, getWorkflowDraft, saveWorkflowDraft, setWorkflowActiveModel } from '@/lib/createDrafts';
import { normalizeImageDraftForModel, type ImageCreateDraftSnapshot } from '@/lib/create/imageDraft';

export function useImageCreateDraftPersistence({
  defaultModelId,
  selectedModel,
  setSelectedModel,
  snapshot,
  applySnapshot,
}: {
  defaultModelId: string;
  selectedModel?: string | null;
  setSelectedModel: (modelId: string) => void;
  snapshot: ImageCreateDraftSnapshot;
  applySnapshot: (modelId: string, snapshot?: ImageCreateDraftSnapshot | null) => Promise<void> | void;
}) {
  const hasRestoredDraftRef = useRef(false);
  const hydratedModelRef = useRef<string | null>(null);
  const isHydratingDraftRef = useRef(false);
  const skipNextAutosaveRef = useRef(false);

  const hydrateSnapshot = useCallback(async (modelId: string, nextSnapshot?: ImageCreateDraftSnapshot | null) => {
    isHydratingDraftRef.current = true;
    try {
      await applySnapshot(modelId, normalizeImageDraftForModel(modelId, nextSnapshot));
    } finally {
      isHydratingDraftRef.current = false;
    }
  }, [applySnapshot]);

  const switchModel = useCallback(async (nextModelId: string, currentSnapshot: ImageCreateDraftSnapshot) => {
    const currentModelId = selectedModel || defaultModelId;
    saveWorkflowDraft('image', currentModelId, normalizeImageDraftForModel(currentModelId, currentSnapshot));
    setWorkflowActiveModel('image', nextModelId);
    setSelectedModel(nextModelId);

    const nextDraft = getWorkflowDraft<ImageCreateDraftSnapshot>('image', nextModelId);
    hydratedModelRef.current = nextModelId;
    await hydrateSnapshot(nextModelId, nextDraft);
  }, [defaultModelId, hydrateSnapshot, selectedModel, setSelectedModel]);

  useEffect(() => {
    const restoreInitialDraft = async () => {
      const modelId = getWorkflowActiveModel('image') || defaultModelId;
      setWorkflowActiveModel('image', modelId);
      setSelectedModel(modelId);
      hydratedModelRef.current = modelId;

      try {
        const draft = getWorkflowDraft<ImageCreateDraftSnapshot>('image', modelId);
        await hydrateSnapshot(modelId, draft);
      } catch (error) {
        console.warn('Failed to restore image draft', error);
      } finally {
        hasRestoredDraftRef.current = true;
      }
    };

    void restoreInitialDraft();
  }, [defaultModelId, hydrateSnapshot, setSelectedModel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleReuseDraft = (event: Event) => {
      const detail = (event as CustomEvent<CreateReuseDraftEventDetail>).detail;
      if (detail?.workflow !== 'image' || !detail.modelId) return;

      const modelId = detail.modelId;
      const draft = getWorkflowDraft<ImageCreateDraftSnapshot>('image', modelId);
      setWorkflowActiveModel('image', modelId);
      setSelectedModel(modelId);
      hydratedModelRef.current = modelId;
      skipNextAutosaveRef.current = true;
      void hydrateSnapshot(modelId, draft);
    };

    window.addEventListener(CREATE_REUSE_DRAFT_EVENT, handleReuseDraft as EventListener);
    return () => window.removeEventListener(CREATE_REUSE_DRAFT_EVENT, handleReuseDraft as EventListener);
  }, [hydrateSnapshot, setSelectedModel]);

  useEffect(() => {
    if (!hasRestoredDraftRef.current || isHydratingDraftRef.current) return;
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }
    const modelId = selectedModel || defaultModelId;
    setWorkflowActiveModel('image', modelId);
    saveWorkflowDraft('image', modelId, normalizeImageDraftForModel(modelId, snapshot));
  }, [defaultModelId, selectedModel, snapshot]);

  return {
    hydrateSnapshot,
    switchModel,
    hasRestoredDraftRef,
  };
}
