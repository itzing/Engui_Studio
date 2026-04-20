'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getWorkflowActiveModel, getWorkflowDraft, saveWorkflowDraft, setWorkflowActiveModel } from '@/lib/createDrafts';
import type { ImageCreateDraftSnapshot } from '@/lib/create/imageDraft';

export const PENDING_MOBILE_IMAGE_MODEL_KEY = 'engui.mobile.pending-image-model';

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
  const skipNextModelHydrationRef = useRef(false);

  const hydrateSnapshot = useCallback(async (modelId: string, nextSnapshot?: ImageCreateDraftSnapshot | null) => {
    isHydratingDraftRef.current = true;
    try {
      await applySnapshot(modelId, nextSnapshot);
    } finally {
      isHydratingDraftRef.current = false;
    }
  }, [applySnapshot]);

  const skipNextModelHydration = useCallback(() => {
    skipNextModelHydrationRef.current = true;
  }, []);

  useEffect(() => {
    let modelId = getWorkflowActiveModel('image') || defaultModelId;

    if (typeof window !== 'undefined') {
      try {
        const pendingModelId = window.localStorage.getItem(PENDING_MOBILE_IMAGE_MODEL_KEY);
        if (pendingModelId) {
          modelId = pendingModelId;
          setWorkflowActiveModel('image', pendingModelId);
          window.localStorage.removeItem(PENDING_MOBILE_IMAGE_MODEL_KEY);
        }
      } catch {
        // ignore storage errors
      }
    }

    setSelectedModel(modelId);
    hasRestoredDraftRef.current = true;
  }, [defaultModelId, setSelectedModel]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (!hasRestoredDraftRef.current || !selectedModel || hydratedModelRef.current === selectedModel) return;

      if (skipNextModelHydrationRef.current) {
        skipNextModelHydrationRef.current = false;
        hydratedModelRef.current = selectedModel;
        return;
      }

      hydratedModelRef.current = selectedModel;

      try {
        const draft = getWorkflowDraft<ImageCreateDraftSnapshot>('image', selectedModel);
        await hydrateSnapshot(selectedModel, draft);
      } catch (error) {
        console.warn('Failed to restore image draft', error);
      }
    };

    void restoreDraft();
  }, [hydrateSnapshot, selectedModel]);

  useEffect(() => {
    if (!hasRestoredDraftRef.current || isHydratingDraftRef.current) return;
    const modelId = selectedModel || defaultModelId;
    setWorkflowActiveModel('image', modelId);
    saveWorkflowDraft('image', modelId, snapshot);
  }, [defaultModelId, selectedModel, snapshot]);

  return {
    hydrateSnapshot,
    skipNextModelHydration,
    hasRestoredDraftRef,
  };
}
