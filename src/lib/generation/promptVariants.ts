function hashString(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function splitVariantOptions(input: string): string[] {
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

export function resolvePromptVariants(input: string, seed: number | string | null | undefined): string {
  if (!input || !input.includes('{') || !input.includes('|')) {
    return input;
  }

  const seedText = seed === null || seed === undefined || seed === '' ? '0' : String(seed);
  let groupIndex = 0;

  return input.replace(/\{([^{}\n]*\|[^{}\n]*)\}/g, (match, content: string) => {
    const options = splitVariantOptions(content);

    if (options.length < 2) {
      return match;
    }

    const hash = hashString(`${seedText}:${groupIndex}:${content}`);
    groupIndex += 1;
    return options[hash % options.length];
  });
}

export function hasResolvedPromptVariants(original: string, resolved: string): boolean {
  return original !== resolved;
}
