import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { ensureHelperMode } from '@/lib/helperMode';
import { characterTraitDefinitions } from '@/lib/characters/schema';
import type { CharacterExtractResult, CharacterTraitMap } from '@/lib/characters/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const settingsService = new SettingsService();
const userId = 'user-with-settings';
const allowedTraitKeys = new Set(characterTraitDefinitions.map((definition) => definition.key));

type ExtractedPayload = {
  name?: unknown;
  gender?: unknown;
  summary?: unknown;
  traits?: unknown;
  confidence?: unknown;
  warnings?: unknown;
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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeConfidence(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeTraits(value: unknown): CharacterTraitMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key, traitValue]) => allowedTraitKeys.has(key) && typeof traitValue === 'string')
    .map(([key, traitValue]) => [key, traitValue.trim()])
    .filter(([, traitValue]) => traitValue.length > 0);
  return Object.fromEntries(entries);
}

async function extractWithVisionHelper(imageUrl: string, imageDataUrl: string): Promise<CharacterExtractResult> {
  const settingsResult = await settingsService.getSettings(userId);
  const local = settingsResult.settings.visionPromptHelper?.local;
  const provider = settingsResult.settings.visionPromptHelper?.provider;

  if (provider !== 'local' || !local?.baseUrl || !local?.model) {
    throw new Error('Vision Prompt Helper provider is not configured for Character extraction');
  }

  await ensureHelperMode('vision');

  const imagePayload = imageDataUrl || imageUrl;
  const response = await fetch(`${local.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(local.apiKey ? { Authorization: `Bearer ${local.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: local.model,
      temperature: 0.15,
      max_tokens: 1800,
      stream: false,
      messages: [
        {
          role: 'system',
          content: `You extract reusable character presets from a single reference image for image generation workflows. Focus on persistent visible character traits and build the most complete safe profile possible without hallucinating hidden details. Ignore scene, background, and framing except when needed to explain why a trait is unclear. Treat makeup, styling, pose, lighting, and camera effects separately from natural traits. If a trait is unclear or hidden, omit it and mention the limitation in warnings. Return only valid JSON with exactly these keys: {"name":"string","gender":"string","summary":"string","traits":{"ethnicity":"string","skin_tone":"string","undertone":"string","face_shape":"string","eye_color":"string","eye_shape":"string","eyebrow_shape":"string","eyebrow_density":"string","nose_shape":"string","lip_color_natural":"string","lip_shape":"string","lip_fullness":"string","hair_color":"string","hair_texture":"string","hair_length_base":"string","body_build":"string","body_proportions":"string","shoulder_width":"string","waist_definition":"string","hip_width":"string","leg_length":"string","neck_length":"string","pelvis_structure":"string","pelvis_to_torso_ratio":"string","lower_abdomen_shape":"string","glute_shape":"string","glute_position":"string","glute_definition":"string","leg_structure":"string","posture":"string","neck_alignment":"string","hip_alignment":"string","knee_alignment":"string"},"confidence":"low|medium|high","warnings":["string"]}. Use English. Keep omitted or unclear traits out of the traits object entirely.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Extract a reusable character trait profile from this image.',
                '',
                'Rules:',
                '- Capture only visible, persistent character traits',
                '- Do not invent hidden lower-body or facial details',
                '- Prefer omission over guessing',
                '- summary should be short and human-readable',
                '- name should stay empty unless clearly present or strongly implied by visible context',
                '- warnings should explain occlusion or ambiguity',
                '- traits must use only the allowed schema keys',
                '- output valid JSON only',
              ].join('\n')
            },
            {
              type: 'image_url',
              image_url: { url: imagePayload }
            }
          ]
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
    throw new Error(data?.error?.message || `Character extraction provider request failed with status ${response.status}`);
  }

  if (!rawText) {
    throw new Error('Character extraction provider returned empty text');
  }

  const parsed = JSON.parse(extractJsonObject(rawText)) as ExtractedPayload;
  const traits = normalizeTraits(parsed.traits);
  const summary = normalizeString(parsed.summary) || 'Character extracted from image';

  return {
    name: normalizeString(parsed.name),
    gender: normalizeString(parsed.gender),
    summary,
    traits,
    confidence: normalizeConfidence(parsed.confidence),
    warnings: normalizeWarnings(parsed.warnings),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body?.imageUrl === 'string' ? body.imageUrl.trim() : '';
    const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';

    if (!imageUrl && !imageDataUrl) {
      return NextResponse.json({ success: false, error: 'imageUrl or imageDataUrl is required' }, { status: 400 });
    }

    const extracted = await extractWithVisionHelper(imageUrl, imageDataUrl);
    return NextResponse.json({ success: true, extracted, provider: 'vision-helper' });
  } catch (error: any) {
    console.error('Failed to extract character:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
