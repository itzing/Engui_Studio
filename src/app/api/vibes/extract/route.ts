import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { heuristicExtractVibe, normalizeChipArray } from '@/lib/vibes/utils';
import { ensureHelperMode } from '@/lib/helperMode';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const settingsService = new SettingsService();
const userId = 'user-with-settings';

type ExtractedPayload = {
  name?: unknown;
  baseDescription?: unknown;
  tags?: unknown;
  compatibleSceneTypes?: unknown;
  confidence?: unknown;
};

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

function extractTextContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('');
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

function normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

async function extractWithPromptHelper(prompt: string) {
  const settingsResult = await settingsService.getSettings(userId);
  const local = settingsResult.settings.promptHelper?.local;
  const provider = settingsResult.settings.promptHelper?.provider;

  if (provider !== 'local' || !local?.baseUrl || !local?.model) {
    throw new Error('Prompt Helper provider is not configured for Vibe extraction');
  }

  await ensureHelperMode('text');

  const response = await fetch(`${local.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(local.apiKey ? { Authorization: `Bearer ${local.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: local.model,
      temperature: 0.2,
      max_tokens: 500,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You extract reusable vibe presets from creative prompts. A vibe preset is a compact reusable atmosphere definition, not a caption, not a scene summary, and not a character description. Prioritize mood, emotional tone, lighting, color atmosphere, texture, era feeling, softness/harshness, romanticism, tension, calmness, nostalgia, dreaminess, environmental feel, and cinematic energy. Avoid anchoring on specific people, clothing, props, exact locations, or one-off narrative actions unless they are essential to the vibe itself. Return only valid JSON with exactly these keys: {"name":"string","baseDescription":"string","tags":["string"],"compatibleSceneTypes":["string"],"confidence":"low|medium|high"}. Use concise English. Keep tags lowercase. Keep compatibleSceneTypes short, lowercase, and advisory only. Do not return markdown or explanations.'
        },
        {
          role: 'user',
          content: [
            'Extract a reusable vibe preset from this prompt.',
            '',
            'Prompt:',
            prompt,
            '',
            'Rules:',
            '- Think: what reusable atmosphere should survive if the subject, place, and props are changed?',
            '- baseDescription must describe the vibe core, not retell the literal scene',
            '- baseDescription should usually focus on mood, light, air, emotional tone, texture, palette, elegance, nostalgia, softness, drama, serenity, etc.',
            '- Avoid wording like "woman at a train station", "person sitting", "holding a bag", "standing in a room" unless truly essential to the vibe',
            '- Prefer scene-agnostic wording when possible',
            '- name should be short and human-readable, and should describe the vibe rather than the scene',
            '- tags should be concise lowercase chips, mostly mood/aesthetic descriptors, not literal object inventory',
            '- compatibleSceneTypes should be a small advisory list like portrait, landscape, interior, exterior, cinematic',
            '- if uncertain, still return best-effort JSON',
            '',
            'Bad extraction example:',
            '- prompt: "A woman in a rainy neon alley... moody blue-magenta cyberpunk atmosphere"',
            '- bad baseDescription: "woman in a neon alley at night"',
            '- why bad: too literal and scene-specific',
            '',
            'Good extraction example:',
            '- good baseDescription: "moody cyberpunk night atmosphere, neon reflections, wet surfaces, blue-magenta glow, noir tension"'
          ].join('\n')
        }
      ]
    })
  });

  const data = await response.json() as OpenAIChatResponse;
  const message = data?.choices?.[0]?.message;
  const contentText = extractTextContent(message?.content);
  const reasoningText = extractTextContent(message?.reasoning_content);
  const rawText = (contentText || reasoningText || '').trim();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Vibe extraction provider request failed with status ${response.status}`);
  }

  if (!rawText) {
    throw new Error('Vibe extraction provider returned empty text');
  }

  const parsed = JSON.parse(extractJsonObject(rawText)) as ExtractedPayload;
  const baseDescription = typeof parsed.baseDescription === 'string' ? parsed.baseDescription.trim() : '';

  if (!baseDescription) {
    throw new Error('Vibe extraction provider returned empty baseDescription');
  }

  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : heuristicExtractVibe(prompt).name,
    baseDescription,
    tags: normalizeChipArray(parsed.tags),
    compatibleSceneTypes: normalizeChipArray(parsed.compatibleSceneTypes),
    confidence: normalizeConfidence(parsed.confidence),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'prompt is required' }, { status: 400 });
    }

    try {
      const extracted = await extractWithPromptHelper(prompt);
      return NextResponse.json({ success: true, extracted, provider: 'prompt-helper' });
    } catch (providerError) {
      console.warn('Vibe extraction prompt-helper path failed, falling back to heuristic extraction:', providerError);
      const extracted = heuristicExtractVibe(prompt);
      return NextResponse.json({ success: true, extracted, provider: 'heuristic' });
    }
  } catch (error: any) {
    console.error('Failed to extract vibe:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
