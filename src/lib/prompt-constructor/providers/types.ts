import type { PromptBlockCategory } from '@/lib/prompt-constructor/types';

export type PromptBlock = {
  id: string;
  label: string;
  content: string;
  category: PromptBlockCategory;
  source: 'characters' | 'vibes' | 'poses' | 'manual';
  tags: string[];
  sourceId?: string;
};

export type PromptBlockProviderInput = {
  slotId?: string;
  query?: string;
  workspaceId?: string | null;
};

export type PromptBlockProvider = {
  source: 'characters' | 'vibes' | 'poses';
  loadBlocks: (input: PromptBlockProviderInput) => Promise<PromptBlock[]>;
};
