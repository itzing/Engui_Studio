export type TraitVolatility = 'core' | 'stable' | 'flexible';

export type CharacterTraitDefinition = {
  key: string;
  label: string;
  group: string;
  volatility: TraitVolatility;
};

export type CharacterTraitGroup = {
  id: string;
  label: string;
};

export const characterTraitGroups: CharacterTraitGroup[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'face', label: 'Face' },
  { id: 'hair', label: 'Hair' },
  { id: 'body', label: 'Body' },
  { id: 'lower-body', label: 'Lower Body' },
  { id: 'posture', label: 'Posture and Alignment' },
];

export const characterTraitDefinitions: CharacterTraitDefinition[] = [
  { key: 'ethnicity', label: 'Ethnicity', group: 'identity', volatility: 'core' },
  { key: 'skin_tone', label: 'Skin tone', group: 'identity', volatility: 'core' },
  { key: 'undertone', label: 'Undertone', group: 'identity', volatility: 'core' },

  { key: 'face_shape', label: 'Face shape', group: 'face', volatility: 'core' },
  { key: 'eye_color', label: 'Eye color', group: 'face', volatility: 'core' },
  { key: 'eye_shape', label: 'Eye shape', group: 'face', volatility: 'stable' },
  { key: 'eyebrow_shape', label: 'Eyebrow shape', group: 'face', volatility: 'stable' },
  { key: 'eyebrow_density', label: 'Eyebrow density', group: 'face', volatility: 'flexible' },
  { key: 'nose_shape', label: 'Nose shape', group: 'face', volatility: 'core' },
  { key: 'lip_color_natural', label: 'Natural lip color', group: 'face', volatility: 'core' },
  { key: 'lip_shape', label: 'Lip shape', group: 'face', volatility: 'stable' },
  { key: 'lip_fullness', label: 'Lip fullness', group: 'face', volatility: 'stable' },

  { key: 'hair_color', label: 'Hair color', group: 'hair', volatility: 'core' },
  { key: 'hair_texture', label: 'Hair texture', group: 'hair', volatility: 'core' },
  { key: 'hair_length_base', label: 'Base hair length', group: 'hair', volatility: 'stable' },

  { key: 'body_build', label: 'Body build', group: 'body', volatility: 'stable' },
  { key: 'body_proportions', label: 'Body proportions', group: 'body', volatility: 'stable' },
  { key: 'shoulder_width', label: 'Shoulder width', group: 'body', volatility: 'stable' },
  { key: 'waist_definition', label: 'Waist definition', group: 'body', volatility: 'flexible' },
  { key: 'hip_width', label: 'Hip width', group: 'body', volatility: 'stable' },
  { key: 'leg_length', label: 'Leg length', group: 'body', volatility: 'stable' },
  { key: 'neck_length', label: 'Neck length', group: 'body', volatility: 'flexible' },

  { key: 'pelvis_structure', label: 'Pelvis structure', group: 'lower-body', volatility: 'stable' },
  { key: 'pelvis_to_torso_ratio', label: 'Pelvis-to-torso ratio', group: 'lower-body', volatility: 'stable' },
  { key: 'lower_abdomen_shape', label: 'Lower abdomen shape', group: 'lower-body', volatility: 'flexible' },
  { key: 'glute_shape', label: 'Glute shape', group: 'lower-body', volatility: 'stable' },
  { key: 'glute_position', label: 'Glute position', group: 'lower-body', volatility: 'stable' },
  { key: 'glute_definition', label: 'Glute definition', group: 'lower-body', volatility: 'flexible' },
  { key: 'leg_structure', label: 'Leg structure', group: 'lower-body', volatility: 'stable' },

  { key: 'posture', label: 'Posture', group: 'posture', volatility: 'flexible' },
  { key: 'neck_alignment', label: 'Neck alignment', group: 'posture', volatility: 'flexible' },
  { key: 'hip_alignment', label: 'Hip alignment', group: 'posture', volatility: 'flexible' },
  { key: 'knee_alignment', label: 'Knee alignment', group: 'posture', volatility: 'flexible' },
];

export const characterTraitDefinitionMap = new Map(
  characterTraitDefinitions.map((definition) => [definition.key, definition])
);

export const characterTraitDefinitionsByGroup = characterTraitGroups.map((group) => ({
  group,
  traits: characterTraitDefinitions.filter((definition) => definition.group === group.id),
}));
