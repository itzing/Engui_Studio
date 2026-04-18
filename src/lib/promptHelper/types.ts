export type PromptHelperProviderType = 'disabled' | 'local';
export type PromptHelperProfile = 'default' | 'wan22-video';

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
  helperProfile?: PromptHelperProfile;
  width?: number;
  height?: number;
}

export interface PromptHelperDebugInfo {
  content?: string;
  reasoningContent?: string;
  finishReason?: string;
}

export interface PromptHelperResult {
  improvedPrompt: string;
  improvedNegativePrompt: string;
}

export class PromptHelperProviderError extends Error {
  debug?: PromptHelperDebugInfo;

  constructor(message: string, debug?: PromptHelperDebugInfo) {
    super(message);
    this.name = 'PromptHelperProviderError';
    this.debug = debug;
  }
}

export interface PromptHelperProvider {
  improve(request: PromptHelperRequest): Promise<PromptHelperResult>;
  testConnection(): Promise<void>;
}
