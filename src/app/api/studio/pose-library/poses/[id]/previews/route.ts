import { NextRequest } from 'next/server';
import { createJobMaterializationTask } from '@/lib/materialization/server';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { handleStudioSessionApiError, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';
import { buildStudioPosePreviewPrompt, ensureStudioPoseLibrarySettings, getStudioPose, queueStudioPosePreviewGeneration } from '@/lib/studio-sessions/poseLibraryServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const variantCount = typeof body?.variantCount === 'number' ? Math.max(1, Math.min(8, Math.floor(body.variantCount))) : 1;
    const pose = await getStudioPose(id);
    if (!pose) return studioSessionNoStoreJson({ success: false, error: 'Pose not found' }, { status: 404 });
    const settings = await ensureStudioPoseLibrarySettings(pose.workspaceId);
    const prompt = buildStudioPosePreviewPrompt({ pose, settings });
    const jobs: Array<{ jobId: string; status: unknown }> = [];

    for (let index = 0; index < variantCount; index += 1) {
      const formData = new FormData();
      formData.append('userId', 'user-with-settings');
      formData.append('workspaceId', pose.workspaceId);
      formData.append('language', 'en');
      formData.append('modelId', typeof body?.modelId === 'string' && body.modelId.trim() ? body.modelId.trim() : 'z-image');
      formData.append('prompt', prompt);
      formData.append('use_controlnet', 'false');
      formData.append('width', pose.orientation === 'landscape' ? '1216' : pose.orientation === 'square' ? '1024' : '832');
      formData.append('height', pose.orientation === 'landscape' ? '832' : pose.orientation === 'square' ? '1024' : '1216');
      formData.append('steps', '9');
      formData.append('cfg', '1.0');
      formData.append('randomizeSeed', 'true');
      const response = await submitGenerationFormData(formData);
      const payload = await response.json() as Record<string, unknown>;
      const jobId = typeof payload.jobId === 'string' ? payload.jobId : null;
      if (!response.ok || !payload?.success || !jobId) {
        return studioSessionNoStoreJson({ success: false, error: typeof payload?.error === 'string' ? payload.error : 'Failed to start pose preview generation' }, { status: response.status || 500 });
      }
      await createJobMaterializationTask({
        jobId,
        workspaceId: pose.workspaceId,
        targetType: 'studio_pose_preview',
        targetId: pose.id,
        payload: { promptSnapshot: prompt, settingsSnapshot: settings, variantIndex: index },
      });
      await queueStudioPosePreviewGeneration({ poseId: pose.id, jobId, promptSnapshot: prompt, settingsSnapshot: settings });
      jobs.push({ jobId, status: payload.status || 'IN_QUEUE' });
    }

    return studioSessionNoStoreJson({ success: true, jobs, pose: await getStudioPose(id) });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to queue Studio pose preview generation:');
  }
}
