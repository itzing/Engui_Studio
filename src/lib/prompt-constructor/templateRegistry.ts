import { sceneTemplateV2 } from '@/lib/prompt-constructor/templates/sceneTemplateV2';
import { singleCharacterSceneV1 } from '@/lib/prompt-constructor/templates/singleCharacterSceneV1';
import type { PromptTemplateId } from '@/lib/prompt-constructor/types';

export const promptTemplateRegistry = {
  single_character_scene_v1: singleCharacterSceneV1,
  scene_template_v2: sceneTemplateV2,
} as const;

export function getPromptTemplate(templateId: string) {
  if (templateId === 'single_character_scene_v1') {
    return promptTemplateRegistry.single_character_scene_v1;
  }

  if (templateId === 'scene_template_v2') {
    return promptTemplateRegistry.scene_template_v2;
  }

  return null;
}

export function isPromptTemplateId(value: string): value is PromptTemplateId {
  return value === 'single_character_scene_v1' || value === 'scene_template_v2';
}
