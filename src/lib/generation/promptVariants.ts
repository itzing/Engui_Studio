import { splitPromptVariantOptions } from '@/lib/prompt-wildcards/variants';

function hashString(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function resolveVariantGroup(content: string, seedText: string, groupIndex: number): string | null {
  if (!content.includes('|')) return null;

  const options = splitPromptVariantOptions(content);
  if (options.length < 2) return null;

  const hash = hashString(`${seedText}:${groupIndex}:${content}`);
  return options[hash % options.length];
}

export function resolvePromptVariants(input: string, seed: number | string | null | undefined): string {
  if (!input || !input.includes('{') || !input.includes('|')) {
    return input;
  }

  const seedText = seed === null || seed === undefined || seed === '' ? '0' : String(seed);
  let groupIndex = 0;
  let output = '';

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char !== '{') {
      output += char;
      continue;
    }

    const endIndex = input.indexOf('}', index + 1);
    if (endIndex === -1) {
      output += input.slice(index);
      break;
    }

    const content = input.slice(index + 1, endIndex);
    const resolved = resolveVariantGroup(content, seedText, groupIndex);
    if (resolved === null) {
      output += input.slice(index, endIndex + 1);
    } else {
      output += resolved;
      groupIndex += 1;
    }
    index = endIndex;
  }

  return output;
}

export function hasResolvedPromptVariants(original: string, resolved: string): boolean {
  return original !== resolved;
}
