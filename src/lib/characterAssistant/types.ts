import type { PromptHelperSettings } from '@/lib/promptHelper/types';

export type CharacterAssistantChange = {
  key: string;
  old_value?: string;
  new_value: string;
};

export type CharacterAssistantRequest = {
  instruction: string;
  editableTraits: Record<string, string>;
};

export type CharacterAssistantResult = {
  summary: string;
  action: 'apply_patch';
  changes: CharacterAssistantChange[];
};

export type CharacterAssistantProvider = {
  apply(request: CharacterAssistantRequest): Promise<CharacterAssistantResult>;
};

export type CharacterAssistantSettings = PromptHelperSettings;
