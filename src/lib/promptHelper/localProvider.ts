import { PromptHelperProvider, PromptHelperProviderError, PromptHelperRequest, PromptHelperResult, PromptHelperSettings } from './types';

interface OpenAIChatResponse {
  choices?: Array<{
    finish_reason?: string;
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

function sanitizePromptHelperText(value: string): string {
  return value.replaceAll('"', "'");
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
  const instruction = sanitizePromptHelperText(request.instruction.trim());
  const currentPrompt = sanitizePromptHelperText(request.prompt.trim());
  const currentNegativePrompt = sanitizePromptHelperText(request.negativePrompt?.trim() || '');
  const width = typeof request.width === 'number' && Number.isFinite(request.width) ? Math.round(request.width) : null;
  const height = typeof request.height === 'number' && Number.isFinite(request.height) ? Math.round(request.height) : null;
  const aspectRatio = width && height ? `${width}:${height}` : null;
  const framingHint = buildFramingHint(width, height);

  return [
    currentPrompt || currentNegativePrompt
      ? 'Apply the instruction to the current image prompts.'
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
    'Primary rule: follow the user instruction exactly.',
    'If the instruction is a narrow edit or formatting change, preserve all existing content and change only what the instruction requires.',
    'Do not add creative improvements, style embellishments, extra details, or extra cleanup unless the instruction explicitly asks for them.',
    'Only use target dimensions, aspect ratio, and framing guidance when the instruction explicitly asks for prompt improvement, reframing, recomposition, or new prompt creation.',
    framingHint,
    'If the instruction asks to improve, expand, rewrite, or generate prompts, then you may make broader prompt-engineering improvements.',
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
        temperature: 0.1,
        max_tokens: 4000,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an instruction-following prompt editor for image generation. Your first priority is to apply the user instruction exactly. Preserve the existing positive and negative prompts unless the instruction explicitly asks you to change, improve, expand, shorten, or rewrite them. If the user asks for a narrow edit, formatting change, or substitution, make only that change and keep everything else intact. Only perform broader prompt-engineering improvements when the instruction explicitly requests improvement, rewriting, generation, or optimization. Reply in English only. Return only valid JSON with exactly these keys: {"prompt":"...","negativePrompt":"..."}. Do not return markdown, explanations, labels, or surrounding text.'
          },
          {
            role: 'user',
            content: buildUserMessage(request)
          }
        ]
      })
    });

    const data = await response.json() as OpenAIChatResponse;
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const contentText = extractTextContent(message?.content);
    const reasoningText = extractTextContent(message?.reasoning_content);
    const rawText = contentText || reasoningText;
    const normalizedText = normalizeModelText(rawText);
    const debug = {
      content: contentText || undefined,
      reasoningContent: reasoningText || undefined,
      finishReason: choice?.finish_reason || undefined,
    };

    if (!response.ok) {
      throw new PromptHelperProviderError(data?.error?.message || `Prompt Helper provider request failed with status ${response.status}`, debug);
    }

    if (!normalizedText) {
      throw new PromptHelperProviderError('Prompt Helper provider returned empty text', debug);
    }

    if (choice?.finish_reason === 'length') {
      throw new PromptHelperProviderError('Prompt Helper response was truncated by max_tokens before completing valid JSON', debug);
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
