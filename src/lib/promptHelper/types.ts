export type PromptHelperProviderType = 'disabled' | 'local';

export interface PromptHelperSettings {
  provider?: PromptHelperProviderType;
  local?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
}

export interface PromptHelperRequest {
  prompt: string;
  negativePrompt?: string;
  instruction: string;
  modelId?: string;
}

export interface PromptHelperResult {
  improvedPrompt: string;
  improvedNegativePrompt: string;
}

export interface PromptHelperProvider {
  improve(request: PromptHelperRequest): Promise<PromptHelperResult>;
  testConnection(): Promise<void>;
}
