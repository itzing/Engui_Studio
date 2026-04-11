import { PromptHelperProvider, PromptHelperRequest, PromptHelperResult, PromptHelperSettings } from './types';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function extractTextContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part?.type === 'text' || typeof part?.text === 'string' ? part.text || '' : ''))
      .join('');
  }

  return '';
}

function unwrapQuotedText(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}

function normalizeModelText(value: string): string {
  return unwrapQuotedText(stripCodeFences(value)).trim();
}

function buildUserMessage(request: PromptHelperRequest): string {
  const instruction = request.instruction.trim();
  const currentPrompt = request.prompt.trim();

  if (currentPrompt) {
    return [
      'Rewrite this image generation prompt according to the instruction.',
      request.modelId ? `Target model: ${request.modelId}` : null,
      '',
      'Current prompt:',
      currentPrompt,
      '',
      'Instruction:',
      instruction,
      '',
      'Return only the final rewritten prompt.'
    ].filter(Boolean).join('\n');
  }

  return [
    'Create a new image generation prompt from the instruction below.',
    request.modelId ? `Target model: ${request.modelId}` : null,
    '',
    'Instruction:',
    instruction,
    '',
    'Return only the final prompt.'
  ].filter(Boolean).join('\n');
}

export class LocalPromptHelperProvider implements PromptHelperProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(settings: PromptHelperSettings['local']) {
    if (!settings?.baseUrl?.trim()) {
      throw new Error('Prompt Helper local baseUrl is required');
    }

    if (!settings?.model?.trim()) {
      throw new Error('Prompt Helper local model is required');
    }

    this.baseUrl = normalizeBaseUrl(settings.baseUrl.trim());
    this.model = settings.model.trim();
    this.apiKey = settings.apiKey?.trim() || undefined;
  }

  async improve(request: PromptHelperRequest): Promise<PromptHelperResult> {
    const response = await this.callModel(request);
    return { improvedPrompt: response };
  }

  async testConnection(): Promise<void> {
    const result = await this.callModel({
      prompt: '',
      instruction: 'Write a short cinematic image prompt about neon rain in a futuristic city.',
      modelId: 'z-image',
    });

    if (!result.trim()) {
      throw new Error('Prompt Helper test returned empty text');
    }
  }

  private async callModel(request: PromptHelperRequest): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.4,
        max_tokens: 400,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You improve prompts for image generation. Reply in English only. Reply with only the final prompt text. Do not add explanations, markdown, labels, or surrounding quotes.'
          },
          {
            role: 'user',
            content: buildUserMessage(request)
          }
        ]
      })
    });

    const data = await response.json() as OpenAIChatResponse;

    if (!response.ok) {
      throw new Error(data?.error?.message || `Prompt Helper provider request failed with status ${response.status}`);
    }

    const rawText = extractTextContent(data?.choices?.[0]?.message?.content);
    const normalizedText = normalizeModelText(rawText);

    if (!normalizedText) {
      throw new Error('Prompt Helper provider returned empty text');
    }

    return normalizedText;
  }
}
