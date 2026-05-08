import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import { createJobMaterializationTask } from '@/lib/materialization/server';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { handleStudioSessionApiError, readStudioSessionJsonBody, studioSessionJson, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';
import { clearStudioPoseOpenPoseData, getStudioPose, queueStudioPoseOpenPoseExtraction } from '@/lib/studio-sessions/poseLibraryServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function inferMimeFromPath(value: string) {
  const ext = path.extname(value.split('?')[0]).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function resolveLocalPublicPath(url: string) {
  if (!url.startsWith('/')) return null;
  const normalized = url.split('?')[0].split('#')[0];
  if (!normalized.startsWith('/generations/') && !normalized.startsWith('/results/')) return null;
  const resolved = path.resolve(process.cwd(), 'public', normalized.replace(/^\/+/, ''));
  const publicRoot = path.resolve(process.cwd(), 'public');
  if (!resolved.startsWith(publicRoot)) return null;
  return resolved;
}

async function loadSourceImageBlob(sourceImageUrl: string) {
  const localPath = resolveLocalPublicPath(sourceImageUrl);
  if (localPath) {
    if (!fs.existsSync(localPath)) throw new Error(`Source image does not exist: ${sourceImageUrl}`);
    const bytes = fs.readFileSync(localPath);
    return { blob: new Blob([bytes], { type: inferMimeFromPath(sourceImageUrl) }), filename: path.basename(localPath) || 'source.png' };
  }

  if (!/^https?:\/\//i.test(sourceImageUrl)) {
    throw new Error('sourceImageUrl must be a local public /generations or /results URL, or an http(s) URL');
  }

  const response = await fetch(sourceImageUrl);
  if (!response.ok) throw new Error(`Failed to fetch source image: ${response.status}`);
  const contentType = response.headers.get('content-type') || inferMimeFromPath(sourceImageUrl);
  const blob = await response.blob();
  return { blob: new Blob([await blob.arrayBuffer()], { type: contentType }), filename: path.basename(new URL(sourceImageUrl).pathname) || 'source.png' };
}

function pickSourceImageUrl(pose: NonNullable<Awaited<ReturnType<typeof getStudioPose>>>, body: Record<string, unknown>) {
  const explicit = typeof body.sourceImageUrl === 'string' ? body.sourceImageUrl.trim() : '';
  if (explicit) return explicit;

  const candidateId = typeof body.sourcePreviewCandidateId === 'string' ? body.sourcePreviewCandidateId.trim() : '';
  const candidates = pose.previewCandidates ?? [];
  const candidate = candidateId
    ? candidates.find((item) => item.id === candidateId)
    : candidates.find((item) => item.id === pose.primaryPreviewId) ?? candidates[0];
  return candidate?.assetUrl || candidate?.thumbnailUrl || pose.primaryPreviewUrl || '';
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await readStudioSessionJsonBody(request)) ?? {};
    const pose = await getStudioPose(id);
    if (!pose) return studioSessionNoStoreJson({ success: false, error: 'Pose not found' }, { status: 404 });

    const sourceImageUrl = pickSourceImageUrl(pose, body);
    if (!sourceImageUrl) {
      return studioSessionNoStoreJson({ success: false, error: 'sourceImageUrl or sourcePreviewCandidateId is required' }, { status: 400 });
    }

    if ((pose.openPose.hasOpenPoseImage || pose.openPose.hasKeypoints) && body.confirmReplace !== true) {
      return studioSessionNoStoreJson({ success: true, requiresConfirmation: true, reason: 'Pose already has OpenPose data', pose });
    }

    const source = await loadSourceImageBlob(sourceImageUrl);
    const formData = new FormData();
    formData.append('userId', 'user-with-settings');
    formData.append('workspaceId', pose.workspaceId);
    formData.append('language', 'en');
    formData.append('modelId', 'z-image');
    formData.append('prompt', 'Extract an OpenPose control image and encrypted pose keypoints from the source image.');
    formData.append('task_type', 'openpose_extract');
    formData.append('openpose_resolution', '1024');
    formData.append('detect_body', 'true');
    formData.append('detect_hand', 'true');
    formData.append('detect_face', 'true');
    formData.append('image', source.blob, source.filename);

    const response = await submitGenerationFormData(formData);
    const payload = await response.json() as Record<string, unknown>;
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : null;
    if (!response.ok || !payload?.success || !jobId) {
      return studioSessionNoStoreJson({ success: false, error: typeof payload?.error === 'string' ? payload.error : 'Failed to start OpenPose extraction' }, { status: response.status || 500 });
    }

    await createJobMaterializationTask({
      jobId,
      workspaceId: pose.workspaceId,
      targetType: 'studio_pose_openpose',
      targetId: pose.id,
      payload: { sourceImageUrl },
    });
    await queueStudioPoseOpenPoseExtraction({ poseId: pose.id, jobId, sourceImageUrl });

    return studioSessionNoStoreJson({ success: true, jobId, status: payload.status || 'IN_QUEUE', pose: await getStudioPose(id) }, { status: 202 });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to queue Studio pose OpenPose extraction:');
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const pose = await getStudioPose(id);
    if (!pose) return studioSessionJson({ success: false, error: 'Pose not found' }, { status: 404 });

    const confirmClear = request.nextUrl.searchParams.get('confirmClear') === 'true';
    if ((pose.openPose.hasOpenPoseImage || pose.openPose.hasKeypoints) && !confirmClear) {
      return studioSessionNoStoreJson({ success: true, requiresConfirmation: true, reason: 'Clearing OpenPose data removes the pose control image and encrypted keypoints', pose });
    }

    const cleared = await clearStudioPoseOpenPoseData(id);
    return studioSessionJson({ success: true, pose: cleared });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to clear Studio pose OpenPose data:');
  }
}
