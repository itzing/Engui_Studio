import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { ensureHelperMode } from '@/lib/helperMode';
import { buildPosePrompt, normalizeCharacterCount, normalizeChipArray, normalizePoseCharacters, normalizePoseRelationship } from '@/lib/poses/utils';
import type { PoseExtractResult } from '@/lib/poses/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const settingsService = new SettingsService();
const userId = 'user-with-settings';

type ExtractedPayload = {
  characterCount?: unknown;
  summary?: unknown;
  tags?: unknown;
  characters?: unknown;
  relationship?: unknown;
  confidence?: unknown;
  posePrompt?: unknown;
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

function buildFallbackResult(): PoseExtractResult {
  const characterCount = 1;
  const characters = normalizePoseCharacters([{}], characterCount);
  const relationship = normalizePoseRelationship(null, characterCount);
  return {
    characterCount,
    summary: 'Single character pose',
    posePrompt: buildPosePrompt(characters, relationship) || 'one character, neutral standing pose',
    tags: ['single'],
    characters,
    relationship,
    confidence: 'low',
  };
}

async function extractWithVisionHelper(imageUrl: string, imageDataUrl: string): Promise<PoseExtractResult> {
  const settingsResult = await settingsService.getSettings(userId);
  const local = settingsResult.settings.visionPromptHelper?.local;
  const provider = settingsResult.settings.visionPromptHelper?.provider;

  if (provider !== 'local' || !local?.baseUrl || !local?.model) {
    throw new Error('Vision Prompt Helper provider is not configured for Pose extraction');
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
      temperature: 0.2,
      max_tokens: 1400,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You extract reusable pose presets from reference images for image generation. Focus on visible pose geometry only. Determine whether the image contains 1, 2, or 3 main characters. Describe each character separately with concrete pose fields, then describe spatial and interaction relationships between them when there is more than one character. Ignore framing, scene composition, and environment except where needed to explain pose relationships. Do not invent hidden limbs or unseen body positions. Return only valid JSON with exactly these keys: {"characterCount":1|2|3,"summary":"string","tags":["string"],"characters":[{"index":0,"label":"string|null","orientation":"string","head":"string","gaze":"string","torso":"string","armsHands":"string","legsStance":"string","expression":"string|null"}],"relationship":{"spatialLayout":"string","interaction":"string","contact":"string","symmetry":"string"}|null,"posePrompt":"string","confidence":"low|medium|high"}. Use English. Keep tags lowercase. If only one character is present, relationship must be null.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Extract a reusable pose preset from this image.',
                '',
                'Rules:',
                '- Support only 1, 2, or 3 main characters',
                '- Focus on body orientation, head direction, gaze, torso angle, arm and hand placement, leg stance, and visible expression',
                '- For duo/trio poses, describe relative layout and interaction clearly',
                '- Do not describe camera framing or environment unless necessary to clarify pose relationships',
                '- Do not guess hidden details',
                '- summary should be short and human-readable',
                '- posePrompt should be a detailed reusable pose description for image generation, especially suitable for z-image',
                '- tags should be concise lowercase chips like single, duo, trio, standing, embrace, confrontation, seated, action',
                '- if uncertain, still return best-effort JSON',
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
    throw new Error(data?.error?.message || `Pose extraction provider request failed with status ${response.status}`);
  }

  if (!rawText) {
    throw new Error('Pose extraction provider returned empty text');
  }

  const parsed = JSON.parse(extractJsonObject(rawText)) as ExtractedPayload;
  const characterCount = normalizeCharacterCount(parsed.characterCount);
  const characters = normalizePoseCharacters(parsed.characters, characterCount);
  const relationship = normalizePoseRelationship(parsed.relationship, characterCount);
  const posePrompt = typeof parsed.posePrompt === 'string' && parsed.posePrompt.trim()
    ? parsed.posePrompt.trim()
    : buildPosePrompt(characters, relationship);
  const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : `${characterCount === 1 ? 'Single' : characterCount === 2 ? 'Duo' : 'Trio'} character pose`;

  if (!posePrompt) {
    throw new Error('Pose extraction provider returned empty posePrompt');
  }

  return {
    characterCount,
    summary,
    posePrompt,
    tags: normalizeChipArray(parsed.tags),
    characters,
    relationship,
    confidence: normalizeConfidence(parsed.confidence),
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

    try {
      const extracted = await extractWithVisionHelper(imageUrl, imageDataUrl);
      return NextResponse.json({ success: true, extracted, provider: 'vision-helper' });
    } catch (providerError) {
      console.warn('Pose extraction vision-helper path failed, falling back to heuristic extraction:', providerError);
      const extracted = buildFallbackResult();
      return NextResponse.json({ success: true, extracted, provider: 'heuristic' });
    }
  } catch (error: any) {
    console.error('Failed to extract pose:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
