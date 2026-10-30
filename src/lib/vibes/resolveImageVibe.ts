import { prisma } from '@/lib/prisma';
import { prependImageVibe, type ImageVibeSource } from './imageVibe';

export async function resolveImageVibe(prompt: string, vibeId: string, workspaceId: string) {
  if (!vibeId) return { prompt, sourceVibe: undefined };
  const vibe = await prisma.vibePreset.findFirst({
    where: { id: vibeId, workspaceId, status: 'active' },
    select: { id: true, name: true, baseDescription: true },
  });
  if (!vibe?.baseDescription.trim()) {
    throw new Error('Selected Vibe is unavailable. Choose another Vibe or None.');
  }
  const sourceVibe: ImageVibeSource = { ...vibe, basePrompt: prompt };
  return { prompt: prependImageVibe(prompt, vibe.baseDescription), sourceVibe };
}
