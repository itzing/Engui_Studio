import type {
  CharacterAssistantProvider,
  CharacterAssistantRequest,
  CharacterAssistantResult,
  CharacterAssistantSettings,
} from './types';

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

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
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

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildUserMessage(request: CharacterAssistantRequest): string {
  return [
    'You are editing a character trait draft.',
    'You only receive the editable subset of traits. Do not invent unrelated keys.',
    '',
    'Current editable traits JSON:',
    JSON.stringify(request.editableTraits, null, 2),
    '',
    'Instruction:',
    request.instruction.trim(),
    '',
    'Return JSON with exactly this shape:',
    JSON.stringify({
      summary: 'Short summary',
      action: 'apply_patch',
      changes: [{ key: 'body_build', old_value: 'slim', new_value: 'athletic' }],
    }),
  ].join('\n');
}

export class LocalCharacterAssistantProvider implements CharacterAssistantProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(settings: CharacterAssistantSettings['local']) {
    if (!settings?.baseUrl?.trim()) {
      throw new Error('Character Assistant local baseUrl is required');
    }

    if (!settings?.model?.trim()) {
      throw new Error('Character Assistant local model is required');
    }

    this.baseUrl = normalizeBaseUrl(settings.baseUrl.trim());
    this.model = settings.model.trim();
    this.apiKey = settings.apiKey?.trim() || undefined;
  }

  async apply(request: CharacterAssistantRequest): Promise<CharacterAssistantResult> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.3,
        max_tokens: 700,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are a character editor assistant. Read the provided editable character traits and modify only what the instruction implies. Keep unchanged traits out of the patch. Reply in English only. Return only valid JSON with exactly these keys: {"summary":"...","action":"apply_patch","changes":[{"key":"...","old_value":"...","new_value":"..."}]}. Use action=apply_patch. Do not include markdown or extra prose.'
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
      throw new Error(data?.error?.message || `Character Assistant request failed with status ${response.status}`);
    }

    const rawText = extractTextContent(data?.choices?.[0]?.message?.content).trim();
    if (!rawText) {
      throw new Error('Character Assistant provider returned empty text');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(extractJsonObject(rawText));
    } catch {
      throw new Error('Character Assistant provider returned invalid JSON');
    }

    const action = parsed?.action === 'apply_patch' ? 'apply_patch' : null;
    if (!action) {
      throw new Error('Character Assistant provider returned unsupported action');
    }

    const changes = Array.isArray(parsed?.changes)
      ? parsed.changes
          .map((change: any) => ({
            key: normalizeText(change?.key),
            old_value: normalizeText(change?.old_value),
            new_value: normalizeText(change?.new_value),
          }))
          .filter((change: any) => change.key && change.new_value)
      : [];

    return {
      summary: normalizeText(parsed?.summary) || 'Applied character trait patch',
      action,
      changes,
    };
  }
}
