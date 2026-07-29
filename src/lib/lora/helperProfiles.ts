import type { LoraFileLike, LoraPair } from '@/lib/lora/modelFilters';

export type LoRAHelperProfile = {
  id: string;
  workspaceId?: string | null;
  scope: 'single' | 'pair' | string;
  loraId?: string | null;
  highLoraId?: string | null;
  lowLoraId?: string | null;
  notes: string;
  recommendedHighWeight?: number | null;
  recommendedLowWeight?: number | null;
};

export type LoraWithHelperProfile = {
  id: string;
  helperProfile?: LoRAHelperProfile | null;
  pairHelperProfile?: LoRAHelperProfile | null;
};

export function splitLoRAHelperNotes(notes?: string | null) {
  return (notes || '')
    .split(/\n\s*\n+/)
    .map((group) => group.trim())
    .filter(Boolean);
}

export function hasLoRAHelperContent(profile?: LoRAHelperProfile | null) {
  if (!profile) return false;
  return Boolean(
    profile.notes.trim()
      || typeof profile.recommendedHighWeight === 'number'
      || typeof profile.recommendedLowWeight === 'number'
  );
}

export function getPairHelperProfile<T extends LoraFileLike & LoraWithHelperProfile>(
  pair: Pick<LoraPair<T>, 'high' | 'low'>,
) {
  const highProfile = pair.high?.pairHelperProfile;
  if (
    highProfile
    && highProfile.scope === 'pair'
    && highProfile.highLoraId === pair.high?.id
    && highProfile.lowLoraId === pair.low?.id
  ) {
    return highProfile;
  }

  const lowProfile = pair.low?.pairHelperProfile;
  if (
    lowProfile
    && lowProfile.scope === 'pair'
    && lowProfile.highLoraId === pair.high?.id
    && lowProfile.lowLoraId === pair.low?.id
  ) {
    return lowProfile;
  }

  return null;
}

export function getSingleHelperProfile<T extends LoraWithHelperProfile>(lora?: T | null) {
  return lora?.helperProfile && lora.helperProfile.scope === 'single' ? lora.helperProfile : null;
}
