import { describe, expect, it } from 'vitest';
import { parseLoraWeightInput } from '@/lib/lora/loraWeightInput';

describe('LoRA weight input validation', () => {
  it('accepts complete values in the -10 to 10 range', () => {
    expect(parseLoraWeightInput('-10')).toMatchObject({ value: -10, error: null });
    expect(parseLoraWeightInput('+10')).toMatchObject({ value: 10, error: null });
    expect(parseLoraWeightInput('0.')).toMatchObject({ value: 0, error: null });
    expect(parseLoraWeightInput('.5')).toMatchObject({ value: 0.5, error: null });
  });

  it('reports invalid or out-of-range text without normalizing it', () => {
    expect(parseLoraWeightInput('-').error).toBeTruthy();
    expect(parseLoraWeightInput('abc').error).toBeTruthy();
    expect(parseLoraWeightInput('10.1').error).toBeTruthy();
    expect(parseLoraWeightInput('-10.1').error).toBeTruthy();
  });
});
