export type ImageVibeSource = {
  id: string;
  name: string;
  baseDescription: string;
  basePrompt: string;
};

export function prependImageVibe(prompt: string, description: string): string {
  return description.trim() ? `${description.trim()}\n\n${prompt}` : prompt;
}

export function imageVibeReuse(prompt: string, options: Record<string, unknown>) {
  const source = options.sourceVibe as ImageVibeSource | undefined;
  if (source && typeof source.id === 'string' && typeof source.basePrompt === 'string'
    && typeof source.baseDescription === 'string'
    && prependImageVibe(source.basePrompt, source.baseDescription) === prompt) {
    return { prompt: source.basePrompt, selectedVibeId: source.id };
  }
  // A copied or edited final prompt must not inherit a second Vibe prefix.
  return { prompt, selectedVibeId: '' };
}
