import type { VibePresetSummary } from '@/lib/vibes/types';
import type { PromptBlockProvider } from '@/lib/prompt-constructor/providers/types';

const categoryHints = {
  style: ['cinematic', 'realism', 'illustration', 'anime', 'painterly', 'photo'],
  mood: ['moody', 'nostalgic', 'dreamy', 'romantic', 'soft', 'serene', 'melancholic'],
  palette: ['palette', 'warm', 'cool', 'muted', 'pastel', 'vibrant', 'monochrome'],
  background: ['background', 'atmosphere', 'environment'],
  lighting: ['light', 'lighting', 'sunset', 'golden hour', 'mist', 'shadow'],
  'time-of-day': ['morning', 'afternoon', 'evening', 'night', 'dawn', 'sunset'],
} as const;

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function looksLike(description: string, type: keyof typeof categoryHints): boolean {
  const lower = description.toLowerCase();
  return categoryHints[type].some((hint) => lower.includes(hint));
}

function matchesQuery(block: { label: string; content: string; tags: string[] }, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return `${block.label} ${block.content} ${block.tags.join(' ')}`.toLowerCase().includes(q);
}

export const vibePromptBlockProvider: PromptBlockProvider = {
  source: 'vibes',
  async loadBlocks({ query }) {
    const response = await fetch('/api/vibes?status=active', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load vibes');

    const vibes: VibePresetSummary[] = Array.isArray(data.vibes) ? data.vibes : [];
    const blocks = vibes.flatMap((vibe) => {
      const base = normalizeText(vibe.baseDescription);
      if (!base) return [];

      const items = [
        { category: 'style' as const, enabled: true },
        { category: 'mood' as const, enabled: looksLike(base, 'mood') },
        { category: 'palette' as const, enabled: looksLike(base, 'palette') },
        { category: 'background' as const, enabled: looksLike(base, 'background') },
        { category: 'lighting' as const, enabled: looksLike(base, 'lighting') },
        { category: 'time-of-day' as const, enabled: looksLike(base, 'time-of-day') },
      ];

      return items
        .filter((item) => item.enabled)
        .map((item) => ({
          id: `vibe:${vibe.id}:${item.category}`,
          label: `${vibe.name} · ${item.category}`,
          content: base,
          category: item.category,
          source: 'vibes' as const,
          tags: [vibe.name, ...vibe.tags],
          sourceId: vibe.id,
        }));
    });

    return blocks.filter((block) => matchesQuery(block, query || ''));
  },
};
