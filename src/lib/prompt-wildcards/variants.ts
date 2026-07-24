export function splitPromptVariantOptions(input: string): string[] {
  const options: string[] = [];
  let current = '';
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      current += char;
      continue;
    }

    if (char === '|') {
      options.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  options.push(current);
  return options.map((option) => option.trim()).filter(Boolean);
}

export function getPromptWildcardVariants(value: string): string[] {
  const trimmed = value.trim();
  const variantMatch = trimmed.match(/^\{([^{}\n]*\|[^{}\n]*)\}$/);
  if (!variantMatch) return [];
  return splitPromptVariantOptions(variantMatch[1]);
}

export function normalizePromptWildcardVariant(input: string): string {
  return input.replace(/[{}\n]/g, ' ').replace(/\s+/g, ' ').trim();
}
