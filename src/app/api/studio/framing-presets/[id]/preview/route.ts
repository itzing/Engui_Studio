import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import SettingsService from '@/lib/settingsService';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { decryptStructuredEnvelope } from '@/lib/secureTransport';
import { getStudioFramingPreset } from '@/lib/studio-sessions/framingLibraryServer';
import { composeOpenPosePngControlImage, extractOpenPoseBodyKeypoints, renderOpenPoseControlImage } from '@/lib/studio-sessions/openPoseRenderer';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const settingsService = new SettingsService();
const PREVIEW_ROOT = path.join(process.cwd(), 'public', 'generations', 'studio-sessions', 'framing-previews');
const PREVIEW_PUBLIC_ROOT = '/generations/studio-sessions/framing-previews';

function readDimension(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(256, Math.min(2048, Math.round(parsed)));
}

function parseJsonMaybe(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function decryptAesGcmPayload(block: Record<string, unknown>, key: Buffer, aad: string): string {
  const nonce = typeof block.nonce === 'string' ? Buffer.from(block.nonce, 'base64') : null;
  const payload = typeof block.ciphertext === 'string' ? Buffer.from(block.ciphertext, 'base64') : null;
  if (!nonce || !payload || payload.length <= 16) throw new Error('Encrypted keypoint payload is malformed');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf-8'));
  decipher.setAuthTag(payload.subarray(payload.length - 16));
  return Buffer.concat([decipher.update(payload.subarray(0, payload.length - 16)), decipher.final()]).toString('utf8');
}

async function decodePoseKeypoints(value: unknown): Promise<unknown | null> {
  const parsed = parseJsonMaybe(value);
  if (!parsed) return null;
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed as Record<string, unknown>;
    if (record.people || record.pose_keypoints_2d || record.keypoints || record.points || record.body) return record;
    const { settings } = await settingsService.getSettings('user-with-settings');
    const keyB64 = settings.runpod?.fieldEncKeyB64?.trim();
    if (!keyB64) return null;
    const key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) return null;
    if (typeof record.wrapped_key === 'string' && typeof record.nonce === 'string' && typeof record.ciphertext === 'string' && record.binding && typeof record.binding === 'object') {
      return decryptStructuredEnvelope(key, record as any, record.binding as any);
    }
    if (typeof record.nonce === 'string' && typeof record.ciphertext === 'string') {
      for (const aad of ['engui:zimage:openpose-keypoints:v1', 'engui:zimage:pose-keypoints:v1', 'engui:zimage:result:v1', '']) {
        try {
          return parseJsonMaybe(decryptAesGcmPayload(record, key, aad));
        } catch {}
      }
    }
  }
  return parsed;
}


function resolveLocalPathFromUrl(url: string): string | null {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0];
  if (normalized.startsWith('/generations/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  if (normalized.startsWith('/results/')) return path.join(process.cwd(), 'public', normalized.replace(/^\//, ''));
  return null;
}

function safePreviewDir(workspaceId: string, presetId: string, poseId: string) {
  const resolved = path.resolve(PREVIEW_ROOT, workspaceId, presetId, poseId);
  if (!resolved.startsWith(path.resolve(PREVIEW_ROOT))) throw new Error('Invalid preview path');
  return resolved;
}

function readNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

async function launchZImageControlPreview(params: {
  body: Record<string, unknown>;
  controlImagePath: string;
  width: number;
  height: number;
  poseTitle: string;
  helperPrompt?: string | null;
  workspaceId: string;
  presetId: string;
  poseId: string;
}) {
  const prompt = typeof params.body.prompt === 'string' && params.body.prompt.trim()
    ? params.body.prompt.trim()
    : [params.poseTitle, params.helperPrompt].filter(Boolean).join('. ');

  if (!prompt.trim()) {
    return studioSessionJson({ success: false, error: 'A prompt is required to launch a Z-Image ControlNet preview.' }, { status: 400 });
  }

  const imageBuffer = fs.readFileSync(params.controlImagePath);
  const formData = new FormData();
  formData.append('userId', 'user-with-settings');
  formData.append('workspaceId', params.workspaceId);
  formData.append('modelId', 'z-image');
  formData.append('prompt', prompt);
  formData.append('image', new File([imageBuffer], 'framing-control-preview.png', { type: 'image/png' }));
  formData.append('use_controlnet', 'true');
  formData.append('task_type', '');
  formData.append('controlnet_strength', String(readNumber(params.body.controlnetStrength, 1, 0, 2)));
  formData.append('width', String(params.width));
  formData.append('height', String(params.height));
  formData.append('seed', String(Math.round(readNumber(params.body.seed, 533303727624653, 0, Number.MAX_SAFE_INTEGER))));
  formData.append('steps', String(Math.round(readNumber(params.body.steps, 9, 1, 50))));
  formData.append('cfg', String(readNumber(params.body.cfg, 1, 0.1, 20)));
  formData.append('randomizeSeed', 'false');
  formData.append('studioSessionContext', JSON.stringify({
    source: 'framing-preview',
    workspaceId: params.workspaceId,
    framingPresetId: params.presetId,
    poseId: params.poseId,
    outputDimensions: { width: params.width, height: params.height },
  }));

  return submitGenerationFormData(formData);
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await readStudioSessionJsonBody(request)) ?? {};
    const poseId = typeof body.poseId === 'string' && body.poseId.trim() ? body.poseId.trim() : '';
    if (!poseId) return studioSessionJson({ success: false, error: 'poseId is required' }, { status: 400 });

    if (body.launchPreview === true && body.confirmLaunch !== true) {
      return studioSessionNoStoreJson({ success: true, requiresConfirmation: true, reason: 'Launching a Z-Image ControlNet preview can spend generation budget. Confirm explicitly to continue.' });
    }

    const preset = await getStudioFramingPreset(id);
    if (!preset) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    const pose = await prisma.studioPose.findFirst({ where: { id: poseId, workspaceId: preset.workspaceId }, include: { category: true } });
    if (!pose) return studioSessionJson({ success: false, error: 'Pose not found in this workspace' }, { status: 404 });

    const width = readDimension(body.width, preset.orientation === 'landscape' ? 1216 : preset.orientation === 'square' ? 1024 : 832);
    const height = readDimension(body.height, preset.orientation === 'landscape' ? 832 : preset.orientation === 'square' ? 1024 : 1216);
    const dir = safePreviewDir(preset.workspaceId, preset.id, pose.id);
    const fileName = `${Date.now()}-${width}x${height}.png`;
    const outputPath = path.join(dir, fileName);
    const previewUrl = `${PREVIEW_PUBLIC_ROOT}/${preset.workspaceId}/${preset.id}/${pose.id}/${fileName}`;

    if (typeof pose.openPoseImageUrl === 'string' && pose.openPoseImageUrl.trim()) {
      const sourcePath = resolveLocalPathFromUrl(pose.openPoseImageUrl.trim());
      if (sourcePath && fs.existsSync(sourcePath)) {
        const rendered = await composeOpenPosePngControlImage({ sourcePath, width, height, transform: preset, outputPath });
        if (rendered.buffer.length > 0) {
          if (body.launchPreview === true) {
            return launchZImageControlPreview({ body, controlImagePath: outputPath, width: rendered.width, height: rendered.height, poseTitle: pose.title, helperPrompt: preset.helperPrompt, workspaceId: preset.workspaceId, presetId: preset.id, poseId: pose.id });
          }
          return studioSessionNoStoreJson({
            success: true,
            mode: 'openpose_control',
            previewUrl,
            width: rendered.width,
            height: rendered.height,
            pointCount: null,
            pose: { id: pose.id, title: pose.title, categoryId: pose.categoryId },
            preset,
            helperPrompt: preset.helperPrompt,
          });
        }
      }
    }

    const hasStoredKeypoints = typeof pose.poseKeypointEncryptedJson === 'string' && pose.poseKeypointEncryptedJson.trim().length > 0;

    if (!hasStoredKeypoints) {
      return studioSessionNoStoreJson({
        success: true,
        mode: 'text_only',
        pose: { id: pose.id, title: pose.title, categoryId: pose.categoryId },
        preset,
        width,
        height,
        helperPrompt: preset.helperPrompt,
        message: 'Pose has no local OpenPose PNG or keypoints. Studio generation will fall back to text-only framing guidance.',
      });
    }

    const keypoints = await decodePoseKeypoints(pose.poseKeypointEncryptedJson);
    const bodyPoints = keypoints ? extractOpenPoseBodyKeypoints(keypoints) : [];
    if (bodyPoints.length === 0) {
      return studioSessionNoStoreJson({
        success: true,
        mode: 'text_only',
        pose: { id: pose.id, title: pose.title, categoryId: pose.categoryId },
        preset,
        width,
        height,
        helperPrompt: preset.helperPrompt,
        message: 'OpenPose keypoints could not be decoded into body points. Studio generation will fall back to text-only framing guidance.',
      });
    }

    const rendered = await renderOpenPoseControlImage({ poseKeypointJson: keypoints, width, height, transform: preset, outputPath });

    if (body.launchPreview === true) {
      return launchZImageControlPreview({ body, controlImagePath: outputPath, width: rendered.width, height: rendered.height, poseTitle: pose.title, helperPrompt: preset.helperPrompt, workspaceId: preset.workspaceId, presetId: preset.id, poseId: pose.id });
    }

    return studioSessionNoStoreJson({
      success: true,
      mode: 'openpose_control',
      previewUrl,
      width: rendered.width,
      height: rendered.height,
      pointCount: bodyPoints.length,
      pose: { id: pose.id, title: pose.title, categoryId: pose.categoryId },
      preset,
      helperPrompt: preset.helperPrompt,
    });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to render Studio pose/framing preview:');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const preset = await getStudioFramingPreset(id);
    if (!preset) return studioSessionJson({ success: false, error: 'Framing preset not found' }, { status: 404 });
    const dir = path.resolve(PREVIEW_ROOT, preset.workspaceId, preset.id);
    if (!dir.startsWith(path.resolve(PREVIEW_ROOT))) return studioSessionJson({ success: false, error: 'Invalid preview path' }, { status: 400 });
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return studioSessionJson({ success: true, deletedPreviewScope: `${PREVIEW_PUBLIC_ROOT}/${preset.workspaceId}/${preset.id}` });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to clean Studio framing preview assets:');
  }
}
