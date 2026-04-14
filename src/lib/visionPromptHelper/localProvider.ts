import { VisionPromptHelperProvider, VisionPromptHelperProviderError, VisionPromptHelperRequest, VisionPromptHelperResult, VisionPromptHelperSettings } from './types';

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
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (part?.type === 'text' || typeof part?.text === 'string' ? part.text || '' : '')).join('');
  }
  return '';
}

function stripCodeFences(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}

function normalizePrompt(value: string): string {
  return stripCodeFences(value).trim().replace(/^['"]|['"]$/g, '').trim();
}

function buildInstruction(request: VisionPromptHelperRequest): string {
  return [
    'Analyze the image and write a strong image-generation prompt in English.',
    request.modelId ? `Target image model: ${request.modelId}` : null,
    request.instruction?.trim() ? `Extra instruction: ${request.instruction?.trim()}` : null,
    '',
    'Focus on prompt-relevant details only: subject, pose, framing, composition, camera angle, lens feel, lighting, style, materials, environment, mood, color, and notable scene details.',
    'Do not mention safety policy, uncertainty, or that you are describing an image.',
    'Return plain text only. No JSON, no markdown, no bullets.'
  ].filter(Boolean).join('\n');
}

export class LocalVisionPromptHelperProvider implements VisionPromptHelperProvider {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(settings: VisionPromptHelperSettings['local']) {
    if (!settings?.baseUrl?.trim()) throw new Error('Vision Prompt Helper local baseUrl is required');
    if (!settings?.model?.trim()) throw new Error('Vision Prompt Helper local model is required');
    this.baseUrl = normalizeBaseUrl(settings.baseUrl.trim());
    this.model = settings.model.trim();
    this.apiKey = settings.apiKey?.trim() || undefined;
  }

  async extractPrompt(request: VisionPromptHelperRequest): Promise<VisionPromptHelperResult> {
    const imageUrl = typeof request.imageUrl === 'string' && request.imageUrl.trim() !== '' ? request.imageUrl.trim() : undefined;
    const imageDataUrl = typeof request.imageDataUrl === 'string' && request.imageDataUrl.trim() !== '' ? request.imageDataUrl.trim() : undefined;

    if (!imageUrl && !imageDataUrl) {
      throw new Error('Vision Prompt Helper requires imageUrl or imageDataUrl');
    }

    const imagePayload = imageDataUrl || imageUrl;
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 300,
        stream: false,
        messages: [
          {
            role: 'system',
            content: 'You are an expert visual prompt extractor for image generation. Convert a single image into one concise, vivid, reusable image-generation prompt in English. Focus on visual facts and stylistic cues. Return plain text only.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildInstruction(request) },
              { type: 'image_url', image_url: { url: imagePayload } }
            ]
          }
        ]
      })
    });

    const data = await response.json() as OpenAIChatResponse;
    const text = normalizePrompt(extractTextContent(data?.choices?.[0]?.message?.content));
    if (!response.ok) {
      throw new VisionPromptHelperProviderError(data?.error?.message || `Vision Prompt Helper request failed with status ${response.status}`);
    }
    if (!text) {
      throw new VisionPromptHelperProviderError('Vision Prompt Helper returned empty prompt text');
    }
    return { prompt: text };
  }

  async testConnection(): Promise<void> {
    await this.extractPrompt({
      imageUrl: 'https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/coco_sample.png',
      instruction: 'Describe this as a prompt for image generation.'
    });
  }
}
