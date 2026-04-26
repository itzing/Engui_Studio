export function cleanPromptFragment(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .replace(/\s+\./g, '.')
    .trim()
    .replace(/[.,;:\s]+$/g, '')
    .trim();
}

export function joinPromptFragments(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => cleanPromptFragment(part))
    .filter(Boolean)
    .join(', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderLabeledSentence(label: string, parts: Array<string | null | undefined>): string {
  const content = joinPromptFragments(parts);
  if (!content) return '';
  return `${label}: ${content}.`;
}

export function normalizeRenderedPrompt(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/,\s*\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim();
}
