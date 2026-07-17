import { describe, expect, it } from 'vitest';
import { resolvePromptVariants } from '@/lib/generation/promptVariants';

describe('resolvePromptVariants', () => {
  it('selects one option from each brace group deterministically by seed', () => {
    const prompt = '{4k UHD footage|iphone video from 2000s|vintage 1970s|futuristic 8k} {pov|side-shot|top-down pov|4k video}';

    const first = resolvePromptVariants(prompt, 12345);
    const second = resolvePromptVariants(prompt, 12345);

    expect(first).toBe(second);
    expect(first).not.toContain('{');
    expect(first).not.toContain('|');
    expect(first.split(' ')).not.toHaveLength(0);
  });

  it('keeps normal braces without variant separators unchanged', () => {
    expect(resolvePromptVariants('keep {literal braces} intact', 123)).toBe('keep {literal braces} intact');
  });

  it('usually produces a different option for a different seed', () => {
    const prompt = '{red|blue|green|yellow} dress';

    const variants = new Set(
      Array.from({ length: 8 }, (_value, index) => resolvePromptVariants(prompt, index + 1)),
    );

    expect(variants.size).toBeGreaterThan(1);
  });
});
