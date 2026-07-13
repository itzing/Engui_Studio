import { PromptHelperProfile, PromptHelperProvider, PromptHelperProviderError, PromptHelperRequest, PromptHelperResult, PromptHelperSettings } from './types';

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

function removePromptLabel(value: string): string {
  return value.replace(/^\s*(final\s+)?(rewritten\s+)?(positive\s+)?prompt\s*:\s*/i, '').trim();
}

function normalizePlainPrompt(value: string): string {
  return removePromptLabel(normalizeModelText(value)).trim();
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

function buildDefaultUserMessage(request: PromptHelperRequest): string {
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
    'Return only the final edited positive prompt text.',
    'Do not return JSON.',
    'Do not include markdown, labels, explanations, or surrounding text.',
  ].filter(Boolean).join('\n');
}

function buildWan22UserMessage(request: PromptHelperRequest): string {
  const instruction = sanitizePromptHelperText(request.instruction.trim());
  const currentPrompt = sanitizePromptHelperText(request.prompt.trim());
  const currentNegativePrompt = sanitizePromptHelperText(request.negativePrompt?.trim() || '');
  const width = typeof request.width === 'number' && Number.isFinite(request.width) ? Math.round(request.width) : null;
  const height = typeof request.height === 'number' && Number.isFinite(request.height) ? Math.round(request.height) : null;
  const aspectRatio = width && height ? `${width}:${height}` : null;
  const framingHint = buildFramingHint(width, height);

  return [
    currentPrompt || currentNegativePrompt
      ? 'Rewrite the current WAN 2.2 image-to-video prompts according to the user instruction.'
      : 'Create new WAN 2.2 image-to-video prompts from the user instruction below.',
    request.modelId ? `Target model: ${request.modelId}` : 'Target model: wan22',
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
    'WAN 2.2 profile rules:',
    'Default assumption: this is image-to-video or photo animation from a still image.',
    'Make the user requested action, pose change, gesture, expression change, or camera change the main motion beat.',
    'Use the source or current pose as the opening position, then describe how the subject naturally moves into the requested action.',
    'Use micro-motion as supporting detail for explicit actions: blinking, breathing, hair movement, clothing movement, subtle environmental motion.',
    'For vague animation requests such as animate, make alive, cinematic, or add motion, choose believable micro-motion as the main beat.',
    'Use zero or one simple camera move only, such as slow push-in, gentle pan, slight dolly in, subtle handheld, or subtle orbit.',
    'Keep the clip focused on one action beat, one optional camera move, and one coherent scene.',
    'Keep the positive prompt concise, usually 1 to 2 short sentences.',
    'Bias empty-prompt generation toward a balanced, believable result.',
    'If the instruction is a narrow edit, preserve all existing useful prompt content and change only what the instruction requires.',
    'If the instruction asks to improve, optimize, rewrite, or generate, you may make broader WAN-aware prompt-engineering improvements.',
    'Use target dimensions, aspect ratio, and framing guidance only when they help composition or when the instruction asks for prompt improvement or new prompt creation.',
    framingHint,
    'Leave the negative prompt unchanged.',
    '',
    'Return exactly one final edited positive prompt as plain text.',
  ].filter(Boolean).join('\n');
}

function resolveHelperProfile(request: PromptHelperRequest): PromptHelperProfile {
  return request.helperProfile === 'wan22-video' ? 'wan22-video' : 'default';
}

const WAN22_VIDEO_SYSTEM_PROMPT = [
  'You are an expert instruction-following prompt editor for WAN 2.2 image-to-video prompting.',
  '',
  'Your job is to turn the user\'s rough intent into one polished WAN 2.2 I2V positive prompt that makes a still image feel alive while preserving the image\'s identity, composition, and mood.',
  '',
  'Follow the user instruction exactly. Treat explicit action, pose-change, gesture, expression, or camera-change requests as intentional direction. If the current prompt is non-empty and the instruction is narrow, preserve the existing intent and apply the requested change. If the current prompt is empty, vague, rough, or the instruction asks to improve, optimize, enrich, rewrite, or make it more cinematic, produce one balanced, enriched WAN 2.2-friendly prompt.',
  '',
  'Core I2V doctrine:',
  '- The source image already carries identity, outfit, visible subject appearance, framing, background, and much of the scene. Use those details as continuity anchors while the requested motion changes the image over time.',
  '- Make the user requested action the primary motion beat. For commands such as dance, walk, run, sit, kneel, turn around, raise an arm, look back, lean forward, smile, or change pose, describe that action directly as the main movement.',
  '- Use the source pose as the opening position. Describe how the body shifts from that starting pose into the requested action with clear body movement, weight transfer, gesture, expression, and timing.',
  '- Layer micro-motion around explicit actions as support: natural blinking, breathing, hair movement, clothing movement, subtle environmental motion, and small expression changes.',
  '- For vague animation requests such as animate, make alive, add motion, cinematic, or more natural, choose believable micro-motion as the main beat.',
  '- Keep each short clip focused on one clear action beat, one optional simple camera move, one coherent scene, and realistic physical continuity.',
  '- Use one simple camera move when helpful: slow push-in, gentle pan, slight dolly in, subtle handheld, or a restrained orbit that fits the composition.',
  '- Write like a film director. Use natural English with concrete motion, restrained atmosphere, and realistic physics.',
  '',
  'When source image context is provided, use it as visual ground truth and identity reference. Keep subject identity cues, outfit, overall framing, lighting, background, and camera angle continuous by default. Apply explicit user requests for action, pose, body movement, expression, or camera change as the intended change inside that continuity.',
  '',
  'Preferred prompt shape:',
  '[primary subject motion], [optional secondary motion], [one simple camera move], [one lighting or atmosphere cue], [realism or stability guardrail].',
  '',
  'Good outputs are usually 1-2 concise sentences. They should be rich enough to guide motion and mood while staying concise and focused. Include phrases such as "natural realistic motion", "subtle realistic facial movement", "physically plausible motion", or "cinematic natural motion" when useful.',
  '',
  'Reply in English only. Return the final edited positive prompt text only.',
].join('\n');

function buildPromptHelperMessages(request: PromptHelperRequest): { systemPrompt: string; userMessage: string } {
  const profile = resolveHelperProfile(request);

  if (profile === 'wan22-video') {
    return {
      systemPrompt: WAN22_VIDEO_SYSTEM_PROMPT,
      userMessage: buildWan22UserMessage(request)
    };
  }

  return {
    systemPrompt: 'You are an instruction-following prompt editor for image generation. Your first priority is to apply the user instruction exactly. Preserve the existing positive prompt unless the instruction explicitly asks you to change, improve, expand, shorten, or rewrite it. Do not edit or return the negative prompt. If the user asks for a narrow edit, formatting change, or substitution, make only that change and keep everything else intact. Only perform broader prompt-engineering improvements when the instruction explicitly requests improvement, rewriting, generation, or optimization. Reply in English only. Return only the final edited positive prompt text. Do not return JSON, markdown, explanations, labels, or surrounding text.',
    userMessage: buildDefaultUserMessage(request)
  };
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
    const { systemPrompt, userMessage } = buildPromptHelperMessages(request);

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.1,
        max_tokens: 8000,
        stream: false,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
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
      throw new PromptHelperProviderError('Prompt Helper provider returned empty text', debug, 'empty_response');
    }

    if (choice?.finish_reason === 'length') {
      throw new PromptHelperProviderError('Prompt Helper response was truncated by max_tokens', debug, 'truncated_response');
    }

    const improvedPrompt = normalizePlainPrompt(normalizedText);

    if (!improvedPrompt) {
      throw new PromptHelperProviderError('Prompt Helper provider returned empty prompt text', debug, 'empty_prompt');
    }

    return {
      improvedPrompt,
      improvedNegativePrompt: request.negativePrompt || '',
    };
  }
}
