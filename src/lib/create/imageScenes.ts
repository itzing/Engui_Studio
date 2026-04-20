import type { ScenePresetSummary } from '@/lib/scenes/types';
import type { ImageCreateDraftSnapshot } from './imageDraft';

export const fetchActiveScenePresets = async (workspaceId: string | null): Promise<ScenePresetSummary[]> => {
  if (!workspaceId) {
    return [];
  }

  const response = await fetch(`/api/scenes?workspaceId=${encodeURIComponent(workspaceId)}&status=active`, { cache: 'no-store' });
  const data = await response.json();

  if (!response.ok || !data.success || !Array.isArray(data.scenes)) {
    return [];
  }

  return data.scenes;
};

export const applyScenePromptToImageDraft = (
  snapshot: ImageCreateDraftSnapshot,
  scene: ScenePresetSummary,
): ImageCreateDraftSnapshot => ({
  ...snapshot,
  prompt: scene.generatedScenePrompt || '',
  selectedSceneId: scene.id,
});

export const applySceneToImageDraft = (
  snapshot: ImageCreateDraftSnapshot,
  scene: ScenePresetSummary,
): ImageCreateDraftSnapshot => ({
  ...applyScenePromptToImageDraft(snapshot, scene),
  previewUrl: scene.latestPreviewImageUrl || snapshot.previewUrl || '',
});
