export type PromptWildcardSelectionMode = 'random' | 'sequential';

export type PromptWildcardSelection = {
  indices: number[];
  mode: PromptWildcardSelectionMode;
  startIndex: number;
  cursor: number;
};

export type PromptWildcardSelectionMap = Record<string, PromptWildcardSelection>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

export function parsePromptWildcardIndexList(value: string | null | undefined): number[] | null {
  const trimmed = (value || '').trim();
  if (!trimmed || !/^\d+(?:\s*,\s*\d+)*$/.test(trimmed)) return null;

  const indices = trimmed
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((index) => Number.isInteger(index) && index >= 0);
  return indices.length > 0 ? Array.from(new Set(indices)) : null;
}

export function serializePromptWildcardIndexList(indices: number[]) {
  return Array.from(new Set(indices))
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)
    .join(',');
}

export function normalizePromptWildcardSelections(value: unknown): PromptWildcardSelectionMap {
  if (!isRecord(value)) return {};

  const normalized: PromptWildcardSelectionMap = {};
  Object.entries(value).forEach(([key, selection]) => {
    if (!/^[A-Za-z][A-Za-z0-9_]*(?:__occ_\d+)?$/.test(key) || !isRecord(selection)) return;
    const indices = Array.isArray(selection.indices)
      ? Array.from(new Set(selection.indices
        .map((index) => Number(index))
        .filter((index) => Number.isInteger(index) && index >= 0)))
      : [];
    if (indices.length === 0) return;

    const mode: PromptWildcardSelectionMode = selection.mode === 'sequential' ? 'sequential' : 'random';
    const maxPosition = indices.length - 1;
    const startIndex = clampSelectionPosition(selection.startIndex, maxPosition);
    const cursor = clampSelectionPosition(selection.cursor, maxPosition);
    normalized[key] = { indices, mode, startIndex, cursor };
  });

  return normalized;
}

export function clampSelectionPosition(value: unknown, maxPosition: number) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isInteger(parsed)) return 0;
  return Math.max(0, Math.min(parsed, Math.max(0, maxPosition)));
}
