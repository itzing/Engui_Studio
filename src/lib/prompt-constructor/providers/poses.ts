import type { PosePresetSummary } from '@/lib/poses/types';
import type { PromptBlockProvider } from '@/lib/prompt-constructor/providers/types';

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function matchesQuery(block: { label: string; content: string; tags: string[] }, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return `${block.label} ${block.content} ${block.tags.join(' ')}`.toLowerCase().includes(q);
}

export const posePromptBlockProvider: PromptBlockProvider = {
  source: 'poses',
  async loadBlocks({ query, workspaceId }) {
    if (!workspaceId) return [];

    const response = await fetch(`/api/poses?workspaceId=${encodeURIComponent(workspaceId)}&status=active&characterCount=1`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load poses');

    const poses: PosePresetSummary[] = Array.isArray(data.poses) ? data.poses : [];
    const blocks = poses.flatMap((pose) => {
      const posePrompt = normalizeText(pose.posePrompt);
      const summary = normalizeText(pose.summary);
      const result = [] as Array<{ id: string; label: string; content: string; category: 'pose' | 'action'; source: 'poses'; tags: string[]; sourceId: string }>;

      if (posePrompt) {
        result.push({
          id: `pose:${pose.id}:pose`,
          label: `${pose.name} · Pose`,
          content: posePrompt,
          category: 'pose',
          source: 'poses',
          tags: [pose.name, ...pose.tags],
          sourceId: pose.id,
        });
      }

      if (summary) {
        result.push({
          id: `pose:${pose.id}:action`,
          label: `${pose.name} · Action cue`,
          content: summary,
          category: 'action',
          source: 'poses',
          tags: [pose.name, ...pose.tags],
          sourceId: pose.id,
        });
      }

      return result;
    });

    return blocks.filter((block) => matchesQuery(block, query || ''));
  },
};
