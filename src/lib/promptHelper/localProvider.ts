import { PromptHelperProvider, PromptHelperProviderError, PromptHelperRequest, PromptHelperResult, PromptHelperSettings } from './types';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      reasoning_content?: string | Array<{ type?: string; text?: string }>;
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

function extractJsonObject(value: string): string {
  const trimmed = stripCodeFences(value).trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return trimmed;
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function buildFramingHint(width: number | null, height: number | null): string | null {
  if (!width || !height) {
    return null;
  }

  const ratio = width / height;
  if (ratio >= 1.7) {
    return 'This is a wide frame. Prefer horizontal composition, stronger environmental context, lateral subject placement, and scene structure that uses left-to-right space well.';
  }

  if (ratio <= 0.8) {
    return 'This is a tall frame. Prefer vertical composition, clearer head-to-toe or upper-body framing, stronger top-to-bottom subject flow, and avoid overly wide scene blocking.';
  }

  if (ratio >= 0.9 && ratio <= 1.1) {
    return 'This is a near-square frame. Prefer centered or balanced composition, clean subject grouping, and avoid composition cues that rely on very wide cinematic spread.';
  }

  return 'Use composition cues that fit a moderately rectangular frame, balancing subject emphasis with enough surrounding context.';
}

function buildUserMessage(request: PromptHelperRequest): string {
  const instruction = request.instruction.trim();
  const currentPrompt = request.prompt.trim();
  const currentNegativePrompt = request.negativePrompt?.trim() || '';
  const width = typeof request.width === 'number' && Number.isFinite(request.width) ? Math.round(request.width) : null;
  const height = typeof request.height === 'number' && Number.isFinite(request.height) ? Math.round(request.height) : null;
  const aspectRatio = width && height ? `${width}:${height}` : null;
  const framingHint = buildFramingHint(width, height);

  return [
    currentPrompt
      ? 'Rewrite the current image prompts according to the instruction.'
      : 'Create new image prompts from the instruction below.',
    request.modelId ? `Target model: ${request.modelId}` : null,
    width && height ? `Target dimensions: ${width}x${height}` : null,
    aspectRatio ? `Target aspect ratio: ${aspectRatio}` : null,
    '',
    'Current positive prompt:',
    currentPrompt || '(empty)',
    '',
    'Current negative prompt:',
    currentNegativePrompt || '(empty)',
    '',
    'Instruction:',
    instruction,
    '',
    'When improving the positive prompt, consider the target dimensions and aspect ratio for composition, framing, subject placement, camera distance, and scene structure.',
    framingHint,
    'Do not overstate framing cues when they are not necessary. Keep the prompt natural and only add composition guidance that genuinely helps the requested format.',
    '',
    'Return JSON with exactly these keys:',
    '{"prompt":"...","negativePrompt":"..."}'
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
    return this.callModel(request);
  }

  async testConnection(): Promise<void> {
    const result = await this.callModel({
      prompt: '',
      negativePrompt: '',
      instruction: 'Write a short cinematic image prompt about neon rain in a futuristic city.',
      modelId: 'z-image',
    });

    if (!result.improvedPrompt.trim()) {
      throw new Error('Prompt Helper test returned empty prompt text');
    }
  }

  private async callModel(request: PromptHelperRequest): Promise<PromptHelperResult> {
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
            content: 'You are an expert prompt engineer for image generation. Improve both the positive prompt and the negative prompt while preserving the user\'s core intent. Make the positive prompt clearer, more vivid, better structured, and more useful for image models. Improve composition, subject clarity, style, lighting, camera, materials, color, environment, mood, and quality cues only when they help. Make the negative prompt concise and focused on unwanted artifacts, defects, low-quality traits, and content the user wants avoided. Reply in English only. Return only valid JSON with exactly these keys: {"prompt":"...","negativePrompt":"..."}. Do not return markdown, explanations, labels, or surrounding text.'
          },
          {
            role: 'user',
            content: buildUserMessage(request)
          }
        ]
      })
    });

    const data = await response.json() as OpenAIChatResponse;
    const message = data?.choices?.[0]?.message;
    const contentText = extractTextContent(message?.content);
    const reasoningText = extractTextContent(message?.reasoning_content);
    const rawText = contentText || reasoningText;
    const normalizedText = normalizeModelText(rawText);
    const debug = {
      content: contentText || undefined,
      reasoningContent: reasoningText || undefined,
    };

    if (!response.ok) {
      throw new PromptHelperProviderError(data?.error?.message || `Prompt Helper provider request failed with status ${response.status}`, debug);
    }

    if (!normalizedText) {
      throw new PromptHelperProviderError('Prompt Helper provider returned empty text', debug);
    }

    let parsed: { prompt?: unknown; negativePrompt?: unknown };
    try {
      parsed = JSON.parse(extractJsonObject(normalizedText));
    } catch {
      throw new PromptHelperProviderError('Prompt Helper provider returned invalid JSON', debug);
    }

    const improvedPrompt = typeof parsed.prompt === 'string' ? normalizeModelText(parsed.prompt) : '';
    const improvedNegativePrompt = typeof parsed.negativePrompt === 'string' ? normalizeModelText(parsed.negativePrompt) : '';

    if (!improvedPrompt) {
      throw new PromptHelperProviderError('Prompt Helper provider returned empty prompt text', debug);
    }

    return {
      improvedPrompt,
      improvedNegativePrompt,
    };
  }
}
