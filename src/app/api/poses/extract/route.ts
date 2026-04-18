import { NextRequest, NextResponse } from 'next/server';
import SettingsService from '@/lib/settingsService';
import { ensureHelperMode } from '@/lib/helperMode';
import { heuristicExtractPose } from '@/lib/poses/utils';
import type { PoseExtractResult } from '@/lib/poses/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const settingsService = new SettingsService();
const userId = 'user-with-settings';

const FORBIDDEN_STYLE_PATTERN = /\b(?:girl|boy|woman|man|female|male|lady|gentleman|person|people|sunglasses?|glasses|metallic|outfit|clothing|dress|shirt|top|pants|trousers|shorts|skirt|jacket|coat|hoodie|sweater|jewelry|necklace|earrings?|hairstyle|hair|bun|ponytail|beautiful|pretty|handsome|stylish|fashion|leather|shiny|silver|gold|makeup)\b/gi;

const SUBJECT_PREFIX_PATTERN = /^(?:a|an|the)?\s*(?:girl|boy|woman|man|female|male|lady|gentleman|person|figure|character)\s+/i;

type ExtractedPayload = {
  characterCount?: unknown;
  poseType?: unknown;
  summary?: unknown;
  tags?: unknown;
  confidence?: unknown;
  warnings?: unknown;
  supportContact?: unknown;
  pelvisHips?: unknown;
  torsoShoulders?: unknown;
  leftArm?: unknown;
  rightArm?: unknown;
  leftLeg?: unknown;
  rightLeg?: unknown;
  headGaze?: unknown;
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

function normalizeCharacterCount(value: unknown): 1 | 2 | 3 {
  return value === 2 || value === 3 ? value : 1;
}

function sanitizeFragment(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(SUBJECT_PREFIX_PATTERN, '')
    .replace(FORBIDDEN_STYLE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.])/g, '$1')
    .replace(/^[,;:.\-\s]+/, '')
    .replace(/[,;:.\-\s]+$/, '')
    .trim();
}

function containsForbiddenStyle(value: string): boolean {
  FORBIDDEN_STYLE_PATTERN.lastIndex = 0;
  return FORBIDDEN_STYLE_PATTERN.test(value);
}

function normalizeChipArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => !containsForbiddenStyle(item))
    .slice(0, 12);
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => sanitizeFragment(item))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizePoseType(value: unknown, summary: string, supportContact: string): string {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const source = `${text} ${summary.toLowerCase()} ${supportContact.toLowerCase()}`;

  if (source.includes('duo') && source.includes('seated')) return 'duo seated pose';
  if (source.includes('duo') && source.includes('standing')) return 'duo standing pose';
  if (source.includes('trio') && source.includes('seated')) return 'trio seated pose';
  if (source.includes('trio') && source.includes('standing')) return 'trio standing pose';
  if (source.includes('kneel')) return 'kneeling pose';
  if (source.includes('crouch')) return 'crouching pose';
  if (source.includes('seat') || source.includes('sit') || source.includes('couch') || source.includes('chair') || source.includes('sofa') || source.includes('bench')) return 'seated pose';
  if (source.includes('stand')) return 'standing pose';
  return 'standing pose';
}

function buildPosePromptFromSlots(payload: ExtractedPayload): string {
  const summary = sanitizeFragment(payload.summary);
  const supportContact = sanitizeFragment(payload.supportContact);
  const poseType = normalizePoseType(payload.poseType, summary, supportContact);
  const clauses = [
    supportContact,
    sanitizeFragment(payload.pelvisHips),
    sanitizeFragment(payload.torsoShoulders),
    sanitizeFragment(payload.leftArm),
    sanitizeFragment(payload.rightArm),
    sanitizeFragment(payload.leftLeg),
    sanitizeFragment(payload.rightLeg),
    sanitizeFragment(payload.headGaze),
  ].filter(Boolean);

  if (!clauses.length) return '';
  return [poseType, ...clauses].join('; ');
}

function normalizeSummary(value: unknown, posePrompt: string): string {
  const summary = sanitizeFragment(value);
  if (summary) return summary;

  const lowerPrompt = posePrompt.toLowerCase();
  if (lowerPrompt.includes('seated pose')) return 'seated pose';
  if (lowerPrompt.includes('standing pose')) return 'standing pose';
  if (lowerPrompt.includes('kneeling pose')) return 'kneeling pose';
  if (lowerPrompt.includes('crouching pose')) return 'crouching pose';
  return 'single character pose';
}

function sanitizePosePrompt(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(FORBIDDEN_STYLE_PATTERN, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.])/g, '$1')
    .trim();
}

function buildFallbackResult(): PoseExtractResult {
  return heuristicExtractPose('');
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
      temperature: 0.1,
      max_tokens: 1400,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'You extract generation-ready pose presets from reference images for image generation. Do not write a caption. Do not describe styling. Internally read the pose as structured spatial geometry, then return JSON only. Return exactly these keys: {"characterCount":1|2|3,"poseType":"string","summary":"string","supportContact":"string","pelvisHips":"string","torsoShoulders":"string","leftArm":"string","rightArm":"string","leftLeg":"string","rightLeg":"string","headGaze":"string","tags":["string"],"confidence":"low|medium|high","warnings":["string"]}. Rules: focus only on support/contact, pelvis placement, hip line or pelvic tilt, weight distribution, torso and shoulder line, left arm, right arm, left leg, right leg, and head/gaze. Each body field must be a short spatial phrase, not a full sentence. Describe side, bend/extension, direction, and contact/support when visible. Use concrete geometry such as braced behind the hip, extended outward to the side, bent upward in front of the torso, folded inward along the seat, crossed over the opposite leg, foot tucked near the opposite thigh. If subject-left versus subject-right is unclear, keep the fields consistent and mention the ambiguity in warnings. Never mention gender, clothing, accessories, hair, attractiveness, mood, environment, lighting, or camera framing. Do not guess hidden limbs or unseen positions. Use English. Keep tags lowercase. Output only valid JSON.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Extract a reusable pose preset from this image for z-image.',
                'Return spatial pose geometry, not styling.',
                'Follow this internal read order exactly: support/contact, pelvis/hips, torso/shoulders, left arm, right arm, left leg, right leg, head/gaze.',
                'Describe limb placement relative to the torso, pelvis, seat surface, and the other limbs.',
                'Do not mention clothing, accessories, hairstyle, sunglasses, or other styling details.',
                'If something is unclear, keep the geometry useful and note uncertainty in warnings.',
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
  const builtPosePrompt = buildPosePromptFromSlots(parsed);
  const fallbackPosePrompt = sanitizePosePrompt(parsed.posePrompt);
  const posePrompt = builtPosePrompt || fallbackPosePrompt;

  if (!posePrompt) {
    throw new Error('Pose extraction provider returned empty posePrompt');
  }

  return {
    characterCount,
    summary: normalizeSummary(parsed.summary, posePrompt),
    posePrompt,
    tags: normalizeChipArray(parsed.tags),
    warnings: normalizeWarnings(parsed.warnings),
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
