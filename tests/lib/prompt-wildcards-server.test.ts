import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPromptWildcardFindMany } = vi.hoisted(() => ({
  mockPromptWildcardFindMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    promptWildcard: {
      count: vi.fn(async () => 1),
      findMany: mockPromptWildcardFindMany,
    },
  },
}));

import { expandPromptWildcards } from '@/lib/prompt-wildcards/server';

describe('expandPromptWildcards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPromptWildcardFindMany.mockResolvedValue([
      {
        key: 'hairColor',
        name: 'Hair color',
        value: '{black hair|brown hair|blonde hair}',
      },
      {
        key: 'wardrobe',
        name: 'Wardrobe',
        value: 'black dress',
      },
    ]);
  });

  it('resolves fixed wildcard variants before seeded prompt variants', async () => {
    const result = await expandPromptWildcards('portrait with {hairColor:brown hair}', 'ws-1');

    expect(result.prompt).toBe('portrait with brown hair');
    expect(result.replacements).toEqual([
      {
        key: 'hairColor',
        name: 'Hair color',
        placeholder: '{hairColor:brown hair}',
        variant: 'brown hair',
      },
    ]);
  });

  it('keeps normal wildcard expansion unchanged', async () => {
    const result = await expandPromptWildcards('portrait with {wardrobe}', 'ws-1');

    expect(result.prompt).toBe('portrait with black dress');
    expect(result.replacements).toEqual([
      {
        key: 'wardrobe',
        name: 'Wardrobe',
        placeholder: '{wardrobe}',
      },
    ]);
  });
});
