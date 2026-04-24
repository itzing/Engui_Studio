import { singleCharacterSceneV1 } from '@/lib/prompt-constructor/templates/singleCharacterSceneV1';

export const promptTemplateRegistry = {
  single_character_scene_v1: singleCharacterSceneV1,
} as const;

export type PromptTemplateId = keyof typeof promptTemplateRegistry;

export function getPromptTemplate(templateId: string) {
  if (templateId === 'single_character_scene_v1') {
    return promptTemplateRegistry.single_character_scene_v1;
  }

  return null;
}
