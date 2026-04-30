'use client';

import { getModelById, type ModelConfig } from '@/lib/models/modelConfig';
import {
  CREATE_DRAFT_STATE_STORAGE_KEY,
  LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY,
  createDefaultUnifiedCreateDraftState,
  type CreateWorkflow,
  type UnifiedCreateDraftState,
} from '@/lib/create/createDraftSchema';
import { normalizeCreateDraftState } from '@/lib/create/createDraftMigrations';

const LORA_WEIGHT_NAME_PATTERN = /^lora(?:Weight|_high_\d+_weight|_low_\d+_weight|Weight\d+)$/;

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getLoraParamNames(model: ModelConfig | undefined) {
  return (model?.parameters || [])
    .filter((param) => param.type === 'lora-selector')
    .map((param) => param.name);
}

function getLinkedWeightParamName(loraParamName: string, model: ModelConfig | undefined) {
  const parameters = model?.parameters || [];
  const directSuffix = loraParamName === 'lora' ? 'loraWeight' : loraParamName.replace(/^lora/, 'loraWeight');
  if (parameters.some((param) => param.name === directSuffix && LORA_WEIGHT_NAME_PATTERN.test(param.name))) {
    return directSuffix;
  }

  const wanHigh = loraParamName.match(/^lora_high_(\d+)$/);
  if (wanHigh) {
    const candidate = `lora_high_${wanHigh[1]}_weight`;
    if (parameters.some((param) => param.name === candidate)) return candidate;
  }

  const wanLow = loraParamName.match(/^lora_low_(\d+)$/);
  if (wanLow) {
    const candidate = `lora_low_${wanLow[1]}_weight`;
    if (parameters.some((param) => param.name === candidate)) return candidate;
  }

  return undefined;
}

function sanitizeDraftParameterValues(
  modelId: string,
  parameterValues: Record<string, any> | undefined,
  availableLoraPaths?: Set<string>,
  removedLoraPaths?: Set<string>,
) {
  const model = getModelById(modelId);
  const loraParamNames = getLoraParamNames(model);
  if (!parameterValues || typeof parameterValues !== 'object' || loraParamNames.length === 0) {
    return { parameterValues, changed: false };
  }

  const next = { ...parameterValues };
  let changed = false;

  for (const loraParamName of loraParamNames) {
    const rawValue = next[loraParamName];
    const value = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!value) continue;

    const isRemoved = removedLoraPaths?.has(value) || removedLoraPaths?.has(value.split('/').pop() || '');
    const isMissing = availableLoraPaths ? !availableLoraPaths.has(value) : false;
    if (!isRemoved && !isMissing) continue;

    next[loraParamName] = '';
    const weightParamName = getLinkedWeightParamName(loraParamName, model);
    if (weightParamName) {
      const weightParam = model?.parameters.find((param) => param.name === weightParamName);
      next[weightParamName] = weightParam?.default ?? 1.0;
    }
    changed = true;
  }

  return { parameterValues: changed ? next : parameterValues, changed };
}

function sanitizeWorkflowDrafts(
  state: UnifiedCreateDraftState,
  workflow: CreateWorkflow,
  availableLoraPaths?: Set<string>,
  removedLoraPaths?: Set<string>,
) {
  const bucket = state.workflows[workflow];
  let changed = false;
  const nextDrafts = Object.fromEntries(
    Object.entries(bucket.drafts).map(([modelId, envelope]) => {
      const sanitized = sanitizeDraftParameterValues(
        modelId,
        envelope?.draft?.parameterValues as Record<string, any> | undefined,
        availableLoraPaths,
        removedLoraPaths,
      );

      if (!sanitized.changed) {
        return [modelId, envelope];
      }

      changed = true;
      return [
        modelId,
        {
          ...envelope,
          draft: {
            ...envelope.draft,
            parameterValues: sanitized.parameterValues,
          },
        },
      ];
    }),
  );

  if (!changed) return { state, changed: false };

  return {
    changed: true,
    state: {
      ...state,
      workflows: {
        ...state.workflows,
        [workflow]: {
          ...bucket,
          drafts: nextDrafts,
        },
      },
    },
  };
}

function loadState() {
  const storage = getStorage();
  if (!storage) return createDefaultUnifiedCreateDraftState();
  const raw = storage.getItem(CREATE_DRAFT_STATE_STORAGE_KEY) || storage.getItem(LEGACY_CREATE_DRAFT_STATE_STORAGE_KEY);
  if (!raw) return createDefaultUnifiedCreateDraftState();

  try {
    return normalizeCreateDraftState(JSON.parse(raw));
  } catch {
    return createDefaultUnifiedCreateDraftState();
  }
}

function saveState(state: UnifiedCreateDraftState) {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(CREATE_DRAFT_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function removeDeletedLoraFromCreateDrafts(paths: string[]) {
  const normalized = new Set(paths.map((path) => path.trim()).filter(Boolean));
  if (normalized.size === 0) return false;

  let nextState = loadState();
  let changed = false;

  for (const workflow of ['image', 'video'] as const) {
    const sanitized = sanitizeWorkflowDrafts(nextState, workflow, undefined, normalized);
    if (sanitized.changed) {
      nextState = sanitized.state;
      changed = true;
    }
  }

  if (changed) {
    saveState(nextState);
  }

  return changed;
}

export function sanitizeHydratedLoraParameterValues(
  modelId: string,
  parameterValues: Record<string, any> | undefined,
  availableLoraPaths: string[],
) {
  const available = new Set(availableLoraPaths.map((path) => path.trim()).filter(Boolean));
  return sanitizeDraftParameterValues(modelId, parameterValues, available, undefined);
}
