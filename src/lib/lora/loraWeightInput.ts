export const LORA_WEIGHT_MIN = -10;
export const LORA_WEIGHT_MAX = 10;

export const LORA_WEIGHT_RANGE_LABEL = `${LORA_WEIGHT_MIN} to ${LORA_WEIGHT_MAX}`;

const COMPLETE_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function parseLoraWeightInput(rawValue: unknown): { value: number | null; error: string | null } {
  const text = String(rawValue ?? '').trim();

  if (!text) {
    return { value: null, error: `Enter a LoRA weight from ${LORA_WEIGHT_RANGE_LABEL}.` };
  }

  if (!COMPLETE_NUMBER_PATTERN.test(text)) {
    return { value: null, error: `Enter a valid number from ${LORA_WEIGHT_RANGE_LABEL}.` };
  }

  const value = Number(text);
  if (!Number.isFinite(value)) {
    return { value: null, error: `Enter a valid number from ${LORA_WEIGHT_RANGE_LABEL}.` };
  }

  if (value < LORA_WEIGHT_MIN || value > LORA_WEIGHT_MAX) {
    return { value, error: `LoRA weight must be from ${LORA_WEIGHT_RANGE_LABEL}.` };
  }

  return { value, error: null };
}

export function getLoraWeightInputError(rawValue: unknown): string | null {
  return parseLoraWeightInput(rawValue).error;
}

export function getLoraWeightNumber(rawValue: unknown, fallback = 1): number {
  const parsed = parseLoraWeightInput(rawValue);
  return parsed.error === null && parsed.value !== null ? parsed.value : fallback;
}
