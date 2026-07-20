import type { PromptWildcardStatus, PromptWildcardSummary } from './types';

type PersistedPromptWildcard = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  value: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export const promptWildcardKeyPattern = /^[A-Za-z][A-Za-z0-9_]*$/;

export function normalizePromptWildcardStatus(input: unknown): PromptWildcardStatus {
  return input === 'trash' ? 'trash' : 'active';
}

export function normalizePromptWildcardKey(input: unknown): string {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return '';
  return value.replace(/[^A-Za-z0-9_]/g, '');
}

export function displayNameToPromptWildcardKey(input: string): string {
  const words = input
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return '';

  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join('');
}

export function validatePromptWildcardKey(key: string) {
  if (!promptWildcardKeyPattern.test(key)) {
    throw new Error('key must start with a letter and contain only letters, numbers, or underscores');
  }
}

export function toPromptWildcardSummary(record: PersistedPromptWildcard): PromptWildcardSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    key: record.key,
    name: record.name,
    value: record.value,
    status: normalizePromptWildcardStatus(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
