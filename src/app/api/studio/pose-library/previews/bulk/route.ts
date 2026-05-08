import { NextRequest } from 'next/server';
import { createJobMaterializationTask } from '@/lib/materialization/server';
import { submitGenerationFormData } from '@/lib/generation/submitFormData';
import { handleStudioSessionApiError, readStudioSessionJsonBody, requireStudioSessionString, studioSessionNoStoreJson } from '@/lib/studio-sessions/api';
import { buildStudioPosePreviewPrompt, ensureStudioPoseLibrarySettings, getStudioPose, listStudioPosesMissingPreviews, queueStudioPosePreviewGeneration } from '@/lib/studio-sessions/poseLibraryServer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await readStudioSessionJsonBody(request);
    const workspaceId = requireStudioSessionString(body?.workspaceId, 'workspaceId');
    const categoryId = typeof body?.categoryId === 'string' && body.categoryId.trim() ? body.categoryId.trim() : null;
    const variantCount = typeof body?.variantCount === 'number' ? Math.max(1, Math.min(8, Math.floor(body.variantCount))) : 4;
    const confirmed = body?.confirmed === true;
    const missing = await listStudioPosesMissingPreviews({ workspaceId, categoryId });
    const estimatedImages = missing.length * variantCount;
    if (!confirmed) return studioSessionNoStoreJson({ success: true, requiresConfirmation: true, missingCount: missing.length, variantCount, estimatedImages });

    const jobs: Array<{ poseId: string; jobId: string; status: unknown }> = [];
    for (const poseSummary of missing) {
      const pose = await getStudioPose(poseSummary.id);
      if (!pose) continue;
      const settings = await ensureStudioPoseLibrarySettings(pose.workspaceId);
      const prompt = buildStudioPosePreviewPrompt({ pose, settings });
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
        if (!response.ok || !payload?.success || !jobId) throw new Error(typeof payload?.error === 'string' ? payload.error : 'Failed to start pose preview generation');
        await createJobMaterializationTask({ jobId, workspaceId: pose.workspaceId, targetType: 'studio_pose_preview', targetId: pose.id, payload: { promptSnapshot: prompt, settingsSnapshot: settings, variantIndex: index } });
        await queueStudioPosePreviewGeneration({ poseId: pose.id, jobId, promptSnapshot: prompt, settingsSnapshot: settings });
        jobs.push({ poseId: pose.id, jobId, status: payload.status || 'IN_QUEUE' });
      }
    }
    return studioSessionNoStoreJson({ success: true, missingCount: missing.length, variantCount, estimatedImages, jobs });
  } catch (error) {
    return handleStudioSessionApiError(error, 'Failed to queue bulk Studio pose previews:');
  }
}
