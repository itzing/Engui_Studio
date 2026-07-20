export type PromptWildcardStatus = 'active' | 'trash';

export interface PromptWildcardSummary {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  value: string;
  status: PromptWildcardStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PromptWildcardReplacement {
  key: string;
  name: string;
  placeholder: string;
}
