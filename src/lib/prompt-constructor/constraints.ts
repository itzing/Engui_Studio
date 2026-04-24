import type { ConstraintSnippet } from './types';

export const promptConstructorConstraints: ConstraintSnippet[] = [
  {
    id: 'consistent_anatomy',
    label: 'Consistent anatomy',
    content: 'consistent anatomy',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['anatomy'],
  },
  {
    id: 'no_extra_people',
    label: 'No extra people',
    content: 'no extra people',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['subject', 'clarity'],
  },
  {
    id: 'no_duplicated_limbs',
    label: 'No duplicated limbs',
    content: 'no duplicated limbs',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['anatomy'],
  },
  {
    id: 'clear_subject_focus',
    label: 'Clear subject focus',
    content: 'clear subject focus',
    applicableTemplateIds: ['single_character_scene_v1'],
    tags: ['composition', 'clarity'],
  },
];
