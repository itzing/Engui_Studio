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

  it('expands indexed wildcard subsets before seeded prompt variants', async () => {
    const result = await expandPromptWildcards('portrait with {hairColor:0,2}', 'ws-1');

    expect(result.prompt).toBe('portrait with {black hair|blonde hair}');
    expect(result.replacements).toEqual([
      {
        key: 'hairColor',
        name: 'Hair color',
        placeholder: '{hairColor:0,2}',
        variantIndices: [0, 2],
        mode: 'random',
      },
    ]);
  });

  it('resolves indexed wildcard subsets sequentially and advances cursor', async () => {
    const result = await expandPromptWildcards('portrait with {hairColor:0,2}', 'ws-1', {
      selections: {
        hairColor: {
          indices: [0, 2],
          mode: 'sequential',
          startIndex: 1,
          cursor: 1,
        },
      },
    });

    expect(result.prompt).toBe('portrait with blonde hair');
    expect(result.selections).toEqual({
      hairColor: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 1,
        cursor: 0,
      },
    });
    expect(result.replacements).toEqual([
      {
        key: 'hairColor',
        name: 'Hair color',
        placeholder: '{hairColor:0,2}',
        variant: 'blonde hair',
        variantIndex: 2,
        variantIndices: [0, 2],
        mode: 'sequential',
        selectedPosition: 1,
      },
    ]);
  });

  it('keeps duplicate sequential wildcard placeholders on independent cursors', async () => {
    const result = await expandPromptWildcards('portrait with {hairColor:0,2} and {hairColor:0,2}', 'ws-1', {
      selections: {
        hairColor: {
          indices: [0, 2],
          mode: 'sequential',
          startIndex: 0,
          cursor: 0,
        },
      },
    });

    expect(result.prompt).toBe('portrait with black hair and black hair');
    expect(result.selections).toEqual({
      hairColor: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 0,
        cursor: 0,
      },
      hairColor__occ_0: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 0,
        cursor: 1,
      },
      hairColor__occ_1: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 0,
        cursor: 1,
      },
    });
    expect(result.replacements).toEqual([
      {
        key: 'hairColor',
        name: 'Hair color',
        placeholder: '{hairColor:0,2}',
        variant: 'black hair',
        variantIndex: 0,
        variantIndices: [0, 2],
        mode: 'sequential',
        selectedPosition: 0,
      },
      {
        key: 'hairColor',
        name: 'Hair color',
        placeholder: '{hairColor:0,2}',
        variant: 'black hair',
        variantIndex: 0,
        variantIndices: [0, 2],
        mode: 'sequential',
        selectedPosition: 0,
      },
    ]);
  });

  it('keeps duplicate sequential wildcard occurrence cursors across submissions', async () => {
    const result = await expandPromptWildcards('portrait with {hairColor:0,2} and {hairColor:0,2}', 'ws-1', {
      selections: {
        hairColor: {
          indices: [0, 2],
          mode: 'sequential',
          startIndex: 0,
          cursor: 0,
        },
        hairColor__occ_0: {
          indices: [0, 2],
          mode: 'sequential',
          startIndex: 0,
          cursor: 1,
        },
        hairColor__occ_1: {
          indices: [0, 2],
          mode: 'sequential',
          startIndex: 0,
          cursor: 1,
        },
      },
    });

    expect(result.prompt).toBe('portrait with blonde hair and blonde hair');
    expect(result.selections).toMatchObject({
      hairColor__occ_0: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 0,
        cursor: 0,
      },
      hairColor__occ_1: {
        indices: [0, 2],
        mode: 'sequential',
        startIndex: 0,
        cursor: 0,
      },
    });
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
