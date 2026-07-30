import { describe, expect, it } from 'vitest';
import { getPromptForMode, getPromptVersions, getSourceImagePrompt, getSourceImagePromptVersions } from '@/lib/promptVersions';

describe('prompt version helpers', () => {
  it('extracts original and resolved prompts from options', () => {
    const versions = getPromptVersions({
      prompt: 'fallback prompt',
      options: {
        promptTemplate: 'portrait, {hairColor}',
        resolvedPrompt: 'portrait, blonde hair',
      },
    });

    expect(versions).toEqual({
      originalPrompt: 'portrait, {hairColor}',
      resolvedPrompt: 'portrait, blonde hair',
      hasResolvedPrompt: true,
    });
    expect(getPromptForMode(versions, 'original')).toBe('portrait, {hairColor}');
    expect(getPromptForMode(versions, 'resolved')).toBe('portrait, blonde hair');
  });

  it('extracts explicit video prompt versions from options', () => {
    const versions = getPromptVersions({
      prompt: 'fallback video prompt',
      options: {
        videoPrompt: 'video {walk|run}',
        resolvedVideoPrompt: 'video walk',
      },
    });

    expect(versions).toEqual({
      originalPrompt: 'video {walk|run}',
      resolvedPrompt: 'video walk',
      hasResolvedPrompt: true,
    });
    expect(getPromptForMode(versions, 'resolved')).toBe('video walk');
  });

  it('suppresses resolved prompt when it matches the original prompt', () => {
    const versions = getPromptVersions({
      prompt: 'portrait',
      options: {
        promptTemplate: 'portrait',
        resolvedPrompt: 'portrait',
      },
    });

    expect(versions.hasResolvedPrompt).toBe(false);
    expect(versions.resolvedPrompt).toBeNull();
    expect(getPromptForMode(versions, 'resolved')).toBe('portrait');
  });

  it('extracts the prompt from a source image generation snapshot', () => {
    expect(getSourceImagePrompt({
      prompt: 'video prompt',
      sourceImageGenerationSnapshot: {
        prompt: 'source image prompt',
      },
    })).toBe('source image prompt');
  });

  it('extracts original and resolved source image prompt versions', () => {
    const versions = getSourceImagePromptVersions({
      prompt: 'video prompt',
      sourceImageGenerationSnapshot: {
        promptTemplate: 'source {red|blue} dress',
        prompt: 'source red dress',
        resolvedPrompt: 'source blue dress',
      },
    });

    expect(versions).toEqual({
      originalPrompt: 'source {red|blue} dress',
      resolvedPrompt: 'source blue dress',
      hasResolvedPrompt: true,
    });
  });
});
