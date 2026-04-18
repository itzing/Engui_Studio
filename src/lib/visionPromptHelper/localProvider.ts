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

function buildStructuredInventoryInstruction(request: VisionPromptHelperRequest): string {
  return [
    'Extract a structured visual inventory from this image in English.',
    request.modelId ? `Target model: ${request.modelId}` : null,
    request.instruction?.trim() ? request.instruction.trim() : null,
    'Describe only what is visible or strongly implied by the image.',
    'Do not guess hidden limbs, exact unseen hand or foot positions, unreadable text, or body parts outside the frame.',
    'If a detail is cropped, occluded, or unclear, say unclear instead of inventing specifics.',
    'Pay special attention to body orientation, which side faces the camera, whether the view is front, side, back, or three-quarter, torso angle, hip angle, back arch, stance width, and whether one or both hands hold an object.',
    'Pay equally close attention to head turn and gaze direction. Explicitly note whether the face is frontal, slightly turned, or strongly turned, and whether the eyes look into the camera, past the camera, or off-frame to the left or right.',
    'Explicitly determine camera height and viewpoint: low-angle, eye-level, or high-angle; side-view, rear-side view, front-side view, or frontal view; close-up, medium, medium full-body, or full-body.',
    'Also note if clothing is lifted, displaced, bunched, tied, exposing another garment layer, or emphasizing specific body regions.',
    'State which body regions are visually dominant or emphasized by the composition if that is clearly visible.',
    'Preserve fine visible attributes whenever present: hair color and hairstyle, eye color, makeup, lips, jewelry, exact garment type, straps, ties, pendants, textures, and materials.',
    'Return plain text only using exactly these labeled lines:',
    'subject:',
    'hair_face:',
    'clothing_accessories:',
    'body_orientation:',
    'pose_limb_placement:',
    'hands_object_interaction:',
    'legs_stance:',
    'camera_framing:',
    'emphasized_regions_or_clothing_displacement:',
    'background_environment:',
    'lighting_style:'
  ].filter(Boolean).join('\n');
}

function buildRewriteInstruction(request: VisionPromptHelperRequest, inventory: string): string {
  return [
    'Rewrite the structured visual inventory below into one reusable image-generation prompt in English.',
    request.modelId ? `Target model: ${request.modelId}` : null,
    'Keep as many concrete visible details as possible.',
    'Preserve concrete pose, body orientation, head turn, gaze direction, hand placement, stance, camera angle, emphasized regions, clothing displacement, accessories, and photographic style cues.',
    'Do not add facts that are not present in the inventory.',
    'Do not remove small visible details for brevity.',
    'Return one concise but detail-rich paragraph of plain text only.',
    '',
    'Structured visual inventory:',
    inventory,
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

  private async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>, maxTokens: number): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        stream: false,
        messages,
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
    return text;
  }

  async extractPrompt(request: VisionPromptHelperRequest): Promise<VisionPromptHelperResult> {
    const imageUrl = typeof request.imageUrl === 'string' && request.imageUrl.trim() !== '' ? request.imageUrl.trim() : undefined;
    const imageDataUrl = typeof request.imageDataUrl === 'string' && request.imageDataUrl.trim() !== '' ? request.imageDataUrl.trim() : undefined;

    if (!imageUrl && !imageDataUrl) {
      throw new Error('Vision Prompt Helper requires imageUrl or imageDataUrl');
    }

    const imagePayload = imageDataUrl || imageUrl;
    const inventory = await this.chat([
      {
        role: 'system',
        content: 'Extract a structured visual inventory from the image. Preserve fine visible details, body orientation, head turn, gaze direction, pose, limb placement, hand-object interaction, stance, framing, camera angle, camera height, viewpoint, crop size, clothing construction, clothing displacement, emphasized body regions, accessories, and photographic style cues. Do not guess hidden details. Use the requested labeled-line format exactly. Plain text only.'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildStructuredInventoryInstruction(request) },
          { type: 'image_url', image_url: { url: imagePayload } }
        ]
      }
    ], 700);

    const prompt = await this.chat([
      {
        role: 'system',
        content: 'Rewrite structured visual inventories into concise, detail-rich image-generation prompts in English. Preserve concrete details and do not invent new facts. Be especially faithful to body orientation, head turn, gaze direction, hand placement, stance, camera viewpoint, camera height, crop size, emphasized regions, and clothing displacement. Do not frontalize the face or redirect the eyes toward the camera unless the inventory explicitly says that. Plain text only.'
      },
      {
        role: 'user',
        content: buildRewriteInstruction(request, inventory)
      }
    ], 460);

    return { prompt };
  }

  async testConnection(): Promise<void> {
    await this.extractPrompt({
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8Dwn4GBgYGJAQoAHxcCAr7cGDwAAAAASUVORK5CYII=',
      instruction: 'Describe this as a prompt for image generation.'
    });
  }
}
