export type VisionPromptHelperProviderType = 'disabled' | 'local';

export interface VisionPromptHelperSettings {
  provider?: VisionPromptHelperProviderType;
  local?: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
  };
}

export interface VisionPromptHelperRequest {
  imageUrl?: string;
  imageDataUrl?: string;
  instruction?: string;
  modelId?: string;
}

export interface VisionPromptHelperResult {
  prompt: string;
}

export class VisionPromptHelperProviderError extends Error {
  debug?: Record<string, unknown>;

  constructor(message: string, debug?: Record<string, unknown>) {
    super(message);
    this.name = 'VisionPromptHelperProviderError';
    this.debug = debug;
  }
}

export interface VisionPromptHelperProvider {
  extractPrompt(request: VisionPromptHelperRequest): Promise<VisionPromptHelperResult>;
  testConnection(): Promise<void>;
}
