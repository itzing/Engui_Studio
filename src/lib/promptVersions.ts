export type PromptVersionMode = 'original' | 'resolved';

export type PromptVersions = {
  originalPrompt: string;
  resolvedPrompt: string | null;
  hasResolvedPrompt: boolean;
};

function parseRecord(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function normalizePromptText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function firstPromptText(...values: unknown[]) {
  for (const value of values) {
    const text = normalizePromptText(value);
    if (text.length > 0) return text;
  }
  return '';
}

export function getPromptVersions(input: {
  prompt?: unknown;
  options?: unknown;
  promptTemplate?: unknown;
  resolvedPrompt?: unknown;
}): PromptVersions {
  const options = parseRecord(input.options);
  const originalPrompt = firstPromptText(
    input.promptTemplate,
    options.promptTemplate,
    options.prompt,
    input.prompt,
  );
  const resolvedPrompt = firstPromptText(input.resolvedPrompt, options.resolvedPrompt);

  return {
    originalPrompt,
    resolvedPrompt: resolvedPrompt && resolvedPrompt !== originalPrompt ? resolvedPrompt : null,
    hasResolvedPrompt: Boolean(resolvedPrompt && resolvedPrompt !== originalPrompt),
  };
}

export function getPromptForMode(versions: PromptVersions, mode: PromptVersionMode) {
  return mode === 'resolved' && versions.resolvedPrompt ? versions.resolvedPrompt : versions.originalPrompt;
}
