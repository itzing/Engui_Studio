export function readGenerationSeed(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

export function getGenerationSeedFromOptions(options: unknown): number | null {
  if (!options) return null;
  if (typeof options === 'string') {
    try {
      return getGenerationSeedFromOptions(JSON.parse(options));
    } catch {
      return null;
    }
  }
  if (typeof options !== 'object') return null;
  return readGenerationSeed((options as Record<string, unknown>).seed);
}

export function shouldShowGenerationSeed(type: unknown): type is 'image' | 'video' {
  return type === 'image' || type === 'video';
}

