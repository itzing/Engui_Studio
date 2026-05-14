import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { ensureHelperMode } from '@/lib/helperMode';

const settingsService = new SettingsService();
const userId = 'user-with-settings';

type OpenAIChatResponse = {
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
};

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

function unwrapQuotedText(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function removePromptLabel(value: string): string {
  return value.replace(/^\s*(final\s+)?(z[-\s]?image\s+)?prompt\s*:\s*/i, '').trim();
}

function normalizePlainPrompt(value: string): string {
  return removePromptLabel(unwrapQuotedText(stripCodeFences(value))).trim();
}

const systemPrompt = [
  'You rewrite image-generation prompts for Z-Image.',
  'Input prompts may be tag-style, Pony-style, SD 1.5-style, comma soups, quality-tag lists, or mixed prose.',
  'Convert the input into one coherent, structured English prose prompt that is friendly to Z-Image.',
  'Preserve the core subject, character identity, scene, pose/action, mood, setting, wardrobe, camera/framing, lighting, and style intent.',
  'Remove low-value quality tags and model-era clutter such as masterpiece, best quality, ultra detailed, high detail, trending, score tags, repeated words, and generic tag spam.',
  'Strengthen weak details only when they support what is already present: clarify spatial layout, materials, facial expression, lighting, composition, environment, and atmosphere.',
  'Do not change the story. Do not censor adult content when the prompt clearly describes consenting adults; keep it as adult-only and describe it with clear visual prose rather than tags.',
  'Do not add minors, teen framing, coercion, violence, gore, or unrelated fetish content.',
  'Prefer concrete visual language over abstract quality labels.',
  'Keep the result as a single polished prompt, usually one paragraph. It may be long, but it must remain usable as a direct Z-Image prompt.',
  'Return only the rewritten final prompt text.',
  'Do not return JSON.',
  'Do not use markdown.',
  'Do not include labels such as Prompt:, Rewritten prompt:, or Z-Image prompt: .',
  'Do not explain your changes.',
].join('\n');

function buildUserMessage(prompt: string): string {
  return [
    'Rewrite this prompt for Z-Image as plain final prompt text only:',
    '',
    prompt.trim(),
  ].join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return new NextResponse('Prompt is required', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const settingsResult = await settingsService.getSettings(userId);
    const local = settingsResult.settings.promptHelper?.local;

    if (settingsResult.settings.promptHelper?.provider !== 'local') {
      return new NextResponse('Prompt Helper provider is disabled', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    const baseUrl = local?.baseUrl?.trim();
    const model = local?.model?.trim();
    const apiKey = local?.apiKey?.trim();

    if (!baseUrl || !model) {
      return new NextResponse('Prompt Helper local baseUrl and model are required', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    await ensureHelperMode('text');

    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 8000,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserMessage(prompt) },
        ],
      }),
    });

    const data = await response.json() as OpenAIChatResponse;
    const choice = data?.choices?.[0];
    const contentText = extractTextContent(choice?.message?.content);
    const reasoningText = extractTextContent(choice?.message?.reasoning_content);
    const rewrittenPrompt = normalizePlainPrompt(contentText || reasoningText);

    if (!response.ok) {
      return new NextResponse(data?.error?.message || `Prompt Helper provider request failed with status ${response.status}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (choice?.finish_reason === 'length') {
      return new NextResponse('Z-Image rewrite was truncated by max_tokens', {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (!rewrittenPrompt) {
      return new NextResponse('Prompt Helper returned empty rewrite', { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    return new NextResponse(rewrittenPrompt, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Z-Image prompt rewrite failed';
    return new NextResponse(message, { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
