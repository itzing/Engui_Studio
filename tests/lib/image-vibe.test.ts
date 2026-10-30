import { describe, it, expect, vi } from 'vitest';
import { imageVibeReuse, prependImageVibe } from '@/lib/vibes/imageVibe';
import { createImageDraftSnapshot, normalizeImageDraftForModel } from '@/lib/create/imageDraft';
import { parseStrippedPrompt } from '@/lib/vibes/stripPrompt';
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { vibePreset: { findFirst } } }));
import { resolveImageVibe } from '@/lib/vibes/resolveImageVibe';

describe('Image Vibes', () => {
  it('prepends without changing the base prompt or appending twice on reuse', () => {
    const source = { id: 'v1', name: 'Calm', baseDescription: 'Soft light.', basePrompt: '  A red chair.\n' };
    const prompt = prependImageVibe(source.basePrompt, source.baseDescription);
    expect(prompt).toBe('Soft light.\n\n  A red chair.\n');
    expect(imageVibeReuse(prompt, { sourceVibe: source })).toEqual({ prompt: source.basePrompt, selectedVibeId: 'v1' });
    expect(imageVibeReuse('Edited prompt', { sourceVibe: source })).toEqual({ prompt: 'Edited prompt', selectedVibeId: '' });
    expect(imageVibeReuse(prompt, {})).toEqual({ prompt, selectedVibeId: '' });
  });
  it('preserves selection in normalized per-model drafts, outside parameters', () => {
    const draft = normalizeImageDraftForModel('krea2-turbo', createImageDraftSnapshot({ prompt: 'chair', selectedVibeId: 'v1' }));
    expect(draft.selectedVibeId).toBe('v1');
    expect(draft.parameterValues).not.toHaveProperty('selectedVibeId');
    expect(createImageDraftSnapshot({ prompt: 'reused without vibe' }).selectedVibeId).toBe('');
  });
  it('resolves active workspace Vibes only and preserves original template tokens', async () => {
    findFirst.mockResolvedValue({ id: 'v1', name: 'Calm', baseDescription: '{soft|bright} light' });
    const result = await resolveImageVibe('A {red|blue} chair', 'v1', 'workspace-a');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'v1', status: 'active', workspaceId: 'workspace-a' } }));
    expect(result.prompt).toBe('{soft|bright} light\n\nA {red|blue} chair');
    expect(result.sourceVibe?.basePrompt).toBe('A {red|blue} chair');
    findFirst.mockResolvedValue(null);
    await expect(resolveImageVibe('chair', 'missing', 'workspace-a')).rejects.toThrow('unavailable');
    expect(await resolveImageVibe('chair', '', 'workspace-a')).toEqual({ prompt: 'chair', sourceVibe: undefined });
  });
  it('accepts valid cleanup and preserves brace tokens verbatim', () => {
    expect(parseStrippedPrompt('{"prompt":"A {hairColor} woman in {red|blue}."}', 'Warm light. A {hairColor} woman in {red|blue}.')).toBe('A {hairColor} woman in {red|blue}.');
    expect(() => parseStrippedPrompt('{"prompt":"A woman"}', '{hairColor} woman')).toThrow('tokens');
    expect(() => parseStrippedPrompt('{"prompt":""}', 'chair')).toThrow('empty');
    expect(() => parseStrippedPrompt('reasoning without JSON', 'chair')).toThrow('invalid');
  });
});
